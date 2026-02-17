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

// ── Builtin tools discovery ──────────────────────────────────────────────────

type BuiltinTools struct {
	GeneratedAt string   `json:"generated_at"`
	ToolNames   []string `json:"tool_names"`
	Servers     []Server `json:"servers"`
}

type Server struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Tools       []Tool `json:"tools"`
}

type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

func readBuiltinTools() (*BuiltinTools, error) {
	data, err := os.ReadFile("/tmp/rubic-mcp/builtin_tools.json")
	if err != nil {
		return nil, err
	}
	var bt BuiltinTools
	if err := json.Unmarshal(data, &bt); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}
	return &bt, nil
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

	// Tool list endpoint
	mux.HandleFunc("/tool/list", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		serverFilter := r.URL.Query().Get("server")
		bt, err := readBuiltinTools()
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"generated_at": "",
				"tool_names":   []string{},
				"servers":      []interface{}{},
			})
			return
		}

		if serverFilter != "" {
			filtered := BuiltinTools{
				GeneratedAt: bt.GeneratedAt,
				ToolNames:   []string{},
				Servers:     []Server{},
			}
			for _, srv := range bt.Servers {
				if srv.Name == serverFilter {
					filtered.Servers = append(filtered.Servers, srv)
					for _, t := range srv.Tools {
						filtered.ToolNames = append(filtered.ToolNames, t.Name)
					}
				}
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(filtered)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(bt)
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

// ── CLI tool list mode ───────────────────────────────────────────────────────

func cliToolList(args []string) {
	var serverFilter string
	for i := 0; i < len(args); i++ {
		if args[i] == "--server" && i+1 < len(args) {
			serverFilter = args[i+1]
			i++
		}
	}

	bt, err := readBuiltinTools()
	if err != nil {
		fmt.Fprintf(os.Stderr, "No tools available (builtin_tools.json not found).\n")
		fmt.Fprintf(os.Stderr, "Tools are populated when the agent connects MCP servers.\n")
		os.Exit(0)
	}

	found := false
	for _, srv := range bt.Servers {
		if serverFilter != "" && srv.Name != serverFilter {
			continue
		}
		found = true
		fmt.Printf("Server: %s (%s)\n", srv.Name, srv.Description)
		for _, tool := range srv.Tools {
			fmt.Printf("  - %s: %s\n", tool.Name, tool.Description)
		}
		fmt.Println()
	}

	if !found && serverFilter != "" {
		fmt.Fprintf(os.Stderr, "No server named %q found.\n", serverFilter)
		fmt.Fprintf(os.Stderr, "Available servers: ")
		names := []string{}
		for _, srv := range bt.Servers {
			names = append(names, srv.Name)
		}
		fmt.Fprintf(os.Stderr, "%s\n", strings.Join(names, ", "))
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
		if len(os.Args) < 3 {
			fmt.Fprintf(os.Stderr, "Usage: rubic-mcp-cli tool <list|call> [args...]\n")
			os.Exit(1)
		}
		switch os.Args[2] {
		case "call":
			cliToolCall(os.Args[3:])
		case "list":
			cliToolList(os.Args[3:])
		default:
			fmt.Fprintf(os.Stderr, "Unknown tool subcommand: %s\nUsage: rubic-mcp-cli tool <list|call> [args...]\n", os.Args[2])
			os.Exit(1)
		}
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}
}
