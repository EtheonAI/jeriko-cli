# E2B Hello World Example from their cookbook
# Source: https://github.com/e2b-dev/e2b-cookbook/blob/main/examples/hello-world-python/e2b_hello_world/main.py

from dotenv import load_dotenv
load_dotenv()

from e2b_code_interpreter import Sandbox

def main():
    sbx = Sandbox()  # By default the sandbox is alive for 5 minutes
    execution = sbx.run_code("print('Hello world')") # Execute Python inside the sandbox
    print(execution.logs)
    
    files = sbx.files.list("/")
    print(files)
