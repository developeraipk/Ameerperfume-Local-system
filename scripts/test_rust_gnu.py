import subprocess
import tempfile
import os

td = tempfile.mkdtemp()
src = os.path.join(td, 'hello.rs')
with open(src, 'w') as f:
    f.write('fn main() { println!("hello"); }\n')

p = subprocess.run(['rustup', 'run', 'stable-x86_64-pc-windows-gnu', 'rustc', src, '-o', os.path.join(td, 'hello.exe')], capture_output=True, text=True)
print("STDOUT:", p.stdout)
print("STDERR:", p.stderr)
print("RETURNCODE:", p.returncode)
