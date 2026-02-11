#!/usr/bin/env python3
import json
import re
from collections import Counter, defaultdict
from datetime import datetime

def analyze_redux_state(filepath):
    """Deep analysis of Redux state"""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    # Parse nested JSON
    state = json.loads(data['preloadedState'])
    
    print("="*100)
    print("REDUX STATE ANALYSIS")
    print("="*100)
    
    # 1. Sessions (conversations)
    if 'sessions' in state:
        sessions = state['sessions']
        print("\n📱 SESSIONS (Conversations):")
        print(f"  Current session: {sessions.get('currentSessionId', 'N/A')}")
        print(f"  Total sessions: {len(sessions.get('sessions', {}))}")
        
        for sess_id, sess in list(sessions.get('sessions', {}).items())[:3]:
            print(f"\n  Session ID: {sess_id}")
            print(f"    Title: {sess.get('title', 'N/A')}")
            print(f"    Created: {sess.get('createdAt', 'N/A')}")
            print(f"    Message count: {len(sess.get('messages', []))}")
            print(f"    Status: {sess.get('status', 'N/A')}")
            
            # Message analysis
            messages = sess.get('messages', [])
            if messages:
                print(f"    Message roles: {Counter(m.get('role') for m in messages)}")
                
                # Tool calls
                tool_calls = []
                for msg in messages:
                    if msg.get('toolCalls'):
                        for tc in msg['toolCalls']:
                            tool_name = tc.get('function', {}).get('name', 'unknown')
                            tool_calls.append(tool_name)
                
                if tool_calls:
                    print(f"    Tool calls: {Counter(tool_calls)}")
    
    # 2. WebSocket state
    if 'websocket' in state:
        ws = state['websocket']
        print(f"\n🔌 WEBSOCKET STATE:")
        print(f"  Connected: {ws.get('connected', False)}")
        print(f"  URL: {ws.get('url', 'N/A')}")
        print(f"  Reconnect attempts: {ws.get('reconnectAttempts', 0)}")
    
    # 3. Auth state
    if 'auth' in state:
        auth = state['auth']
        print(f"\n🔐 AUTH STATE:")
        print(f"  Logged in: {auth.get('isLoggedIn', False)}")
        print(f"  User ID: {auth.get('userId', 'N/A')}")
        print(f"  Email: {auth.get('email', 'N/A')}")
        print(f"  Plan: {auth.get('plan', 'N/A')}")
    
    # 4. Chat state
    if 'chat' in state:
        chat = state['chat']
        print(f"\n💬 CHAT STATE:")
        print(f"  Input value: {chat.get('inputValue', '')[:100]}")
        print(f"  Task mode: {chat.get('taskMode', 'N/A')}")
        print(f"  Input mode: {chat.get('inputMode', 'N/A')}")
        print(f"  Files: {len(chat.get('files', []))}")
    
    # 5. Timeline (message stream)
    if 'timeline' in state:
        timeline = state['timeline']
        print(f"\n⏱️ TIMELINE STATE:")
        print(f"  Total items: {len(timeline.get('items', []))}")
        
        items = timeline.get('items', [])
        if items:
            print(f"  Item types: {Counter(item.get('type') for item in items)}")
            
            # Show recent items
            for item in items[-5:]:
                print(f"    - {item.get('type')}: {item.get('id', 'N/A')}")
    
    # 6. File management
    if 'fileManagement' in state:
        fm = state['fileManagement']
        print(f"\n📁 FILE MANAGEMENT:")
        print(f"  Files: {len(fm.get('files', []))}")
        
        for f in fm.get('files', [])[:5]:
            print(f"    - {f.get('name', 'N/A')} ({f.get('size', 0)} bytes)")
    
    # 7. My Browser (browser automation state)
    if 'myBrowser' in state:
        browser = state['myBrowser']
        print(f"\n🌐 BROWSER STATE:")
        print(f"  Current URL: {browser.get('currentUrl', 'N/A')}")
        print(f"  Page title: {browser.get('pageTitle', 'N/A')}")
        print(f"  Loading: {browser.get('loading', False)}")
    
    # 8. Map/Reduce (parallel processing)
    if 'mapReduce' in state:
        mr = state['mapReduce']
        print(f"\n🗺️ MAP/REDUCE STATE:")
        print(f"  Active jobs: {len(mr.get('jobs', {}))}")
        
        for job_id, job in list(mr.get('jobs', {}).items())[:3]:
            print(f"    Job {job_id}:")
            print(f"      Status: {job.get('status', 'N/A')}")
            print(f"      Total: {job.get('total', 0)}")
            print(f"      Completed: {job.get('completed', 0)}")
    
    # 9. Scheduled tasks
    if 'scheduledTask' in state:
        st = state['scheduledTask']
        print(f"\n⏰ SCHEDULED TASKS:")
        print(f"  Total tasks: {len(st.get('tasks', []))}")
    
    # 10. Connectors
    if 'connectors' in state:
        conn = state['connectors']
        print(f"\n🔗 CONNECTORS:")
        print(f"  Installed: {len(conn.get('installed', []))}")
        print(f"  Available: {len(conn.get('available', []))}")
    
    return state

def analyze_all_state(filepath):
    """Analyze all-state.json for network calls"""
    print("\n" + "="*100)
    print("ALL-STATE ANALYSIS (Network Calls)")
    print("="*100)
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Extract network calls
    print("\n🌐 NETWORK CALL PATTERNS:")
    
    # Find URLs
    urls = re.findall(r'https?://[^\s"\'<>]+', content)
    url_domains = Counter(re.sub(r'https?://', '', url).split('/')[0] for url in urls)
    
    print(f"\n  Total URLs found: {len(urls)}")
    print(f"  Unique domains:")
    for domain, count in url_domains.most_common(20):
        print(f"    {domain}: {count}")
    
    # Find API endpoints
    api_endpoints = [url for url in urls if 'api' in url.lower()]
    print(f"\n  API endpoints: {len(api_endpoints)}")
    for endpoint in list(set(api_endpoints))[:10]:
        print(f"    {endpoint}")
    
    # Find WebSocket references
    ws_count = content.count('WebSocket') + content.count('websocket') + content.count('ws://')
    print(f"\n  WebSocket references: {ws_count}")
    
    # Find tool calls
    tool_pattern = r'"function":\s*{\s*"name":\s*"([^"]+)"'
    tools = re.findall(tool_pattern, content)
    print(f"\n  Tool calls found: {len(tools)}")
    print(f"  Tool usage: {Counter(tools).most_common(20)}")
    
    # Find message types
    msg_pattern = r'"role":\s*"([^"]+)"'
    roles = re.findall(msg_pattern, content)
    print(f"\n  Message roles: {Counter(roles)}")
    
    # Find status codes
    status_pattern = r'"status":\s*(\d+)'
    statuses = re.findall(status_pattern, content)
    if statuses:
        print(f"\n  HTTP status codes: {Counter(statuses).most_common()}")
    
    # Find timestamps
    timestamp_pattern = r'"(?:created|updated|sent)At":\s*"([^"]+)"'
    timestamps = re.findall(timestamp_pattern, content)
    if timestamps:
        print(f"\n  Timestamps found: {len(timestamps)}")
        print(f"    First: {timestamps[0] if timestamps else 'N/A'}")
        print(f"    Last: {timestamps[-1] if timestamps else 'N/A'}")
    
    # Find session/conversation IDs
    session_pattern = r'"(?:session|conversation)Id":\s*"([^"]+)"'
    sessions = re.findall(session_pattern, content)
    print(f"\n  Session/Conversation IDs: {len(set(sessions))}")
    
    # Find file attachments
    attachment_pattern = r'"(?:attachment|file).*?name":\s*"([^"]+)"'
    attachments = re.findall(attachment_pattern, content)
    if attachments:
        print(f"\n  File attachments: {len(attachments)}")
        for att in attachments[:10]:
            print(f"    {att}")

if __name__ == '__main__':
    state = analyze_redux_state('/home/ubuntu/upload/state.json')
    analyze_all_state('/home/ubuntu/upload/all-state.json')
    
    # Save parsed state for further analysis
    with open('/home/ubuntu/parsed_state.json', 'w') as f:
        json.dump(state, f, indent=2)
    
    print("\n✅ Parsed state saved to /home/ubuntu/parsed_state.json")
