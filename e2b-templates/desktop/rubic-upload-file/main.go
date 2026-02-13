// rubic-upload-file — Go binary for S3 file uploads via presigned URLs.
// Matches Manus manus-upload-file pattern.
//
// Usage: rubic-upload-file <file_path>
//
// 1. Reads sandbox_api_token from ~/.secrets/sandbox_api_token
// 2. Gets presigned URL from orchestrator: POST {RUNTIME_API_HOST}/api/upload/presign
// 3. Uploads file via presigned PUT
// 4. Prints public URL to stdout

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type PresignResponse struct {
	UploadURL   string `json:"uploadUrl"`
	PublicURL   string `json:"publicUrl"`
	Key         string `json:"key"`
	Error       string `json:"error"`
}

func readToken() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(filepath.Join(home, ".secrets", "sandbox_api_token"))
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func getContentType(filePath string) string {
	ext := filepath.Ext(filePath)
	ct := mime.TypeByExtension(ext)
	if ct == "" {
		ct = "application/octet-stream"
	}
	return ct
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: rubic-upload-file <file_path>\n")
		os.Exit(1)
	}

	filePath := os.Args[1]

	// Check file exists
	info, err := os.Stat(filePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: file not found: %s\n", filePath)
		os.Exit(1)
	}

	// Read token
	token, err := readToken()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading token: %v\n", err)
		os.Exit(1)
	}

	// Get RUNTIME_API_HOST
	host := os.Getenv("RUNTIME_API_HOST")
	if host == "" {
		// Try internal port
		host = "http://127.0.0.1:9330"
	}

	// Request presigned URL
	fileName := filepath.Base(filePath)
	contentType := getContentType(filePath)

	reqBody, _ := json.Marshal(map[string]interface{}{
		"filename":    fileName,
		"contentType": contentType,
		"size":        info.Size(),
	})

	client := &http.Client{Timeout: 30 * time.Second}
	presignURL := fmt.Sprintf("%s/api/upload/presign", host)

	req, err := http.NewRequest("POST", presignURL, bytes.NewReader(reqBody))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating request: %v\n", err)
		os.Exit(1)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-sandbox-token", token)

	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting presigned URL: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var presign PresignResponse
	if err := json.Unmarshal(body, &presign); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing presign response: %v\n", err)
		os.Exit(1)
	}

	if presign.Error != "" {
		fmt.Fprintf(os.Stderr, "Presign error: %s\n", presign.Error)
		os.Exit(1)
	}

	if presign.UploadURL == "" {
		fmt.Fprintf(os.Stderr, "Error: no upload URL returned\n")
		os.Exit(1)
	}

	// Upload file via PUT
	file, err := os.Open(filePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening file: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	putReq, err := http.NewRequest("PUT", presign.UploadURL, file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating PUT request: %v\n", err)
		os.Exit(1)
	}
	putReq.Header.Set("Content-Type", contentType)
	putReq.ContentLength = info.Size()

	putResp, err := client.Do(putReq)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error uploading: %v\n", err)
		os.Exit(1)
	}
	defer putResp.Body.Close()

	if putResp.StatusCode >= 400 {
		errBody, _ := io.ReadAll(putResp.Body)
		fmt.Fprintf(os.Stderr, "Upload failed (%d): %s\n", putResp.StatusCode, string(errBody))
		os.Exit(1)
	}

	// Print public URL
	fmt.Println(presign.PublicURL)
}
