# `.flow` EBNF Grammar v0.1

This grammar documents the intended language shape. The first implementation may use a restricted YAML parser plus schema validation. A custom parser can later use this as a starting point.

```ebnf
flow_file       = version, name, goal, { top_section } ;

version         = "flow", ":", string ;
name            = "name", ":", identifier ;
goal            = "goal", ":", block_string | string ;

top_section     = mode
                | imports
                | files
                | permissions
                | tools
                | workers
                | budgets
                | triggers
                | jobs
                | reflection
                | notifications
                | exports
                | metadata ;

mode            = "mode", ":", ("draft_only" | "supervised" | "auto" | "live_orchestration") ;

imports         = "imports", ":", map(identifier, file_ref) ;
files           = "files", ":", map(identifier, path) ;

permissions     = "permissions", ":", permission_group ;
permission_group = "auto", ":", list(permission)
                 , "ask", ":", list(permission)
                 , "block", ":", list(permission) ;

tools           = "tools", ":", list(tool_name) ;

workers         = "workers", ":", map(identifier, worker_def) ;
worker_def      = "type", ":", worker_type
                , [ "capabilities", ":", list(identifier) ]
                , [ "model_policy", ":", identifier ] ;

budgets         = "budgets", ":", map(identifier, scalar) ;

triggers        = "triggers", ":", list(trigger_def) ;
trigger_def     = "id", ":", identifier
                , "type", ":", trigger_type
                , trigger_body ;

jobs            = "jobs", ":", map(identifier, job_def) ;
job_def         = [ "trigger", ":", trigger_ref_or_inline ]
                , [ "budget", ":", map(identifier, scalar) ]
                , [ "concurrency", ":", map(identifier, scalar) ]
                , "tasks", ":", list(task_def)
                , [ "emit", ":", event_name | list(event_name) ] ;

task_def        = "id", ":", identifier
                , "type", ":", task_type
                , [ "purpose", ":", string | block_string ]
                , task_body
                , [ dependency ]
                , [ failure_policy ]
                , [ routing_policy ]
                , [ budget_policy ] ;

task_type       = "ai_task"
                | "tool_call"
                | "sandbox_command"
                | "human_review"
                | "wait_for_event"
                | "sleep"
                | "foreach"
                | "parallel"
                | "condition"
                | "verify"
                | "emit_event"
                | "invoke_workflow"
                | "memory_patch"
                | "flow_patch"
                | "issue_card" ;

task_body       = ai_task_body
                | tool_call_body
                | sandbox_command_body
                | human_review_body
                | wait_for_event_body
                | foreach_body
                | parallel_body
                | condition_body
                | verify_body
                | emit_event_body
                | invoke_workflow_body
                | patch_body
                | issue_card_body ;

dependency      = "after", ":", list(identifier) | dependency_map ;
dependency_map  = "required", ":", list(identifier), [ "optional", ":", list(identifier) ] ;

failure_policy  = "if_fail", ":", failure_enum
                | "failure", ":", failure_object ;

routing_policy  = "notify", ":", routing_object ;
budget_policy   = "budget", ":", map(identifier, scalar) ;

identifier      = letter, { letter | digit | "_" | "-" } ;
path            = string ;
file_ref        = path ;
tool_name       = identifier, ".", identifier, { ".", identifier } ;
event_name      = identifier, ".", identifier, { ".", identifier } ;
scalar          = string | number | boolean | null ;
```

## Notes

- The grammar intentionally avoids a general expression language for v0.
- Conditions and match rules should use a small safe expression subset.
- Tool names, event names, artifact refs, and worker refs are resolved semantically after parsing.
