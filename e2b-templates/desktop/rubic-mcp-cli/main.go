// rubic-mcp-cli — Go binary for MCP connector server (Composio-backed).
// Matches Manus manus-mcp-cli pattern.
//
// Modes:
//   rubic-mcp-cli serve                                          # Start HTTP server on port 8350
//   rubic-mcp-cli tool call <api_id> --server <srv> --input '{}'  # One-shot API call
//
// Routes connector calls to orchestrator's apiproxy endpoint via RUNTIME_API_HOST.

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	version    = "1.0.0"
	defaultMCP = 8350
)

// ── Token + host helpers ──────────────────────────────────────────────────────

func readToken() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	data, err := os.ReadFile(filepath.Join(home, ".secrets", "sandbox_api_token"))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func runtimeAPIHost() string {
	host := os.Getenv("RUNTIME_API_HOST")
	if host == "" {
		host = "http://127.0.0.1:9330"
	}
	return host
}

// ── API proxy call ────────────────────────────────────────────────────────────

type CallApiRequest struct {
	ApiId     string                 `json:"apiId"`
	Body      map[string]interface{} `json:"body,omitempty"`
	Query     map[string]interface{} `json:"query,omitempty"`
	PathParms map[string]interface{} `json:"path_params,omitempty"`
}

func callApi(apiId string, body map[string]interface{}, query map[string]interface{}) ([]byte, error) {
	token := readToken()
	host := runtimeAPIHost()
	url := fmt.Sprintf("%s/apiproxy.v1.ApiProxyService/CallApi", host)

	payload := CallApiRequest{
		ApiId: apiId,
		Body:  body,
		Query: query,
	}
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBytes))
	if err != nil {
		return nil, fmt.Errorf("request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("x-sandbox-token", token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call error: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// Check for jsonData wrapper
	var wrapper map[string]interface{}
	if err := json.Unmarshal(respBody, &wrapper); err == nil {
		if jsonData, ok := wrapper["jsonData"].(string); ok {
			return []byte(jsonData), nil
		}
	}

	return respBody, nil
}

// ── HTTP serve mode ───────────────────────────────────────────────────────────

func serveMode() {
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","version":"%s","service":"mcp"}`, version)
	})

	// Tool call endpoint
	mux.HandleFunc("/tool/call", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
			return
		}

		var req struct {
			ApiId      string                 `json:"apiId"`
			ApiIdAlt   string                 `json:"api_id"`
			Body       map[string]interface{} `json:"body"`
			Query      map[string]interface{} `json:"query"`
			PathParams map[string]interface{} `json:"path_params"`
		}
		if err := json.Unmarshal(body, &req); err != nil {
			http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
			return
		}

		apiId := req.ApiId
		if apiId == "" {
			apiId = req.ApiIdAlt
		}
		if apiId == "" {
			http.Error(w, `{"error":"apiId is required"}`, http.StatusBadRequest)
			return
		}

		result, err := callApi(apiId, req.Body, req.Query)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			fmt.Fprintf(w, `{"error":"%s"}`, err.Error())
			return
		}

		// Save result to file (Manus pattern)
		resultsDir := "/tmp/rubic-mcp"
		os.MkdirAll(resultsDir, 0755)
		resultFile := filepath.Join(resultsDir, fmt.Sprintf("mcp_result_%d.json", time.Now().Unix()))
		os.WriteFile(resultFile, result, 0644)

		w.Header().Set("Content-Type", "application/json")
		w.Write(result)
	})

	port := os.Getenv("MCP_SERVER_PORT")
	if port == "" {
		port = fmt.Sprintf("%d", defaultMCP)
	}

	addr := fmt.Sprintf("127.0.0.1:%s", port)
	fmt.Printf("Rubic MCP CLI v%s serving on %s\n", version, addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}

// ── CLI tool call mode ────────────────────────────────────────────────────────

func cliToolCall(args []string) {
	if len(args) < 1 {
		fmt.Fprintf(os.Stderr, "Usage: rubic-mcp-cli tool call <api_id> [--server <srv>] [--input '{...}']\n")
		os.Exit(1)
	}

	apiId := args[0]
	var inputStr string

	for i := 1; i < len(args); i++ {
		if args[i] == "--input" && i+1 < len(args) {
			inputStr = args[i+1]
			i++
		}
	}

	var inputData map[string]interface{}
	if inputStr != "" {
		if err := json.Unmarshal([]byte(inputStr), &inputData); err != nil {
			inputData = nil
		}
	}

	result, err := callApi(apiId, inputData, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	// Pretty-print
	var pretty bytes.Buffer
	if err := json.Indent(&pretty, result, "", "  "); err == nil {
		fmt.Println(pretty.String())
	} else {
		fmt.Println(string(result))
	}
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: rubic-mcp-cli <serve|tool> [args...]\n")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "serve":
		serveMode()
	case "tool":
		if len(os.Args) < 3 || os.Args[2] != "call" {
			fmt.Fprintf(os.Stderr, "Usage: rubic-mcp-cli tool call <api_id> [--server <srv>] [--input '{...}']\n")
			os.Exit(1)
		}
		cliToolCall(os.Args[3:])
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}
}
