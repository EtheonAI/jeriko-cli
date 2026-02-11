#!/usr/bin/env python3
import json
import sys
from collections import Counter

def analyze_state_file(filepath):
    """Comprehensive analysis of state.json file"""
    print(f"\n{'='*80}")
    print(f"ANALYZING: {filepath}")
    print(f"{'='*80}\n")
    
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    # Top-level structure
    print("TOP-LEVEL STRUCTURE:")
    for key in data.keys():
        print(f"  - {key}")
    print()
    
    # Analyze preloadedState
    if 'preloadedState' in data:
        state = data['preloadedState']
        print("PRELOADED STATE KEYS:")
        for key in state.keys():
            print(f"  - {key}")
        print()
        
        # Conversations
        if 'conversations' in state:
            convs = state['conversations']
            print(f"CONVERSATIONS:")
            print(f"  Total conversations: {len(convs.get('conversations', {}))}")
            print(f"  Current conversation ID: {convs.get('currentConversationId', 'N/A')}")
            
            # Analyze each conversation
            for conv_id, conv in convs.get('conversations', {}).items():
                print(f"\n  Conversation: {conv_id}")
                print(f"    Title: {conv.get('title', 'N/A')}")
                print(f"    Created: {conv.get('createdAt', 'N/A')}")
                print(f"    Updated: {conv.get('updatedAt', 'N/A')}")
                print(f"    Message count: {len(conv.get('messages', []))}")
                
                # Analyze messages
                messages = conv.get('messages', [])
                if messages:
                    print(f"    Messages:")
                    for i, msg in enumerate(messages[:5]):  # First 5 messages
                        role = msg.get('role', 'unknown')
                        content_preview = str(msg.get('content', ''))[:100]
                        print(f"      [{i}] {role}: {content_preview}...")
                        
                        # Tool calls
                        if 'toolCalls' in msg and msg['toolCalls']:
                            print(f"          Tool calls: {len(msg['toolCalls'])}")
                            for tc in msg['toolCalls'][:3]:
                                print(f"            - {tc.get('function', {}).get('name', 'unknown')}")
        
        # Messages (if separate from conversations)
        if 'messages' in state:
            msgs = state['messages']
            print(f"\nMESSAGES STATE:")
            print(f"  Keys: {list(msgs.keys())}")
        
        # User info
        if 'user' in state:
            user = state['user']
            print(f"\nUSER INFO:")
            print(f"  User ID: {user.get('userId', 'N/A')}")
            print(f"  Email: {user.get('email', 'N/A')}")
            print(f"  Plan: {user.get('plan', 'N/A')}")
        
        # Settings
        if 'settings' in state:
            settings = state['settings']
            print(f"\nSETTINGS:")
            for key, value in settings.items():
                print(f"  {key}: {value}")
    
    # Analyze payload (if exists)
    if 'payload' in data:
        payload = data['payload']
        print(f"\nPAYLOAD:")
        print(f"  Type: {type(payload)}")
        if isinstance(payload, dict):
            print(f"  Keys: {list(payload.keys())}")

def analyze_all_state_file(filepath):
    """Analyze all-state.json for network calls and detailed state"""
    print(f"\n{'='*80}")
    print(f"ANALYZING: {filepath}")
    print(f"{'='*80}\n")
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Try to parse as JSON
    try:
        data = json.loads(content)
        print("File is valid JSON")
        print(f"Top-level type: {type(data)}")
        
        if isinstance(data, dict):
            print(f"Top-level keys: {list(data.keys())}")
        elif isinstance(data, list):
            print(f"Array length: {len(data)}")
            if data:
                print(f"First item type: {type(data[0])}")
                if isinstance(data[0], dict):
                    print(f"First item keys: {list(data[0].keys())}")
    except json.JSONDecodeError as e:
        print(f"Not valid JSON: {e}")
        print("Analyzing as text...")
        
        # Look for patterns
        print(f"File size: {len(content)} bytes")
        print(f"Line count: {content.count(chr(10))}")
        
        # Search for keywords
        keywords = ['http', 'https', 'POST', 'GET', 'WebSocket', 'api.manus.im', 
                   'tool', 'function', 'message', 'conversation']
        print("\nKeyword occurrences:")
        for kw in keywords:
            count = content.count(kw)
            if count > 0:
                print(f"  {kw}: {count}")

if __name__ == '__main__':
    analyze_state_file('/home/ubuntu/upload/state.json')
    analyze_all_state_file('/home/ubuntu/upload/all-state.json')
