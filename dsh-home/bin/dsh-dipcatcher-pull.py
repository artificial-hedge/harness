#!/usr/bin/env python3
import os
import subprocess
import sys
import tempfile

DEST = os.path.expanduser("~/.dsh/ssh-workspaces/me@100.116.120.51/D_dipcatcher")
os.makedirs(DEST, exist_ok=True)
batch = """
lcd {dest}
get -r /D:/dipcatcher/src
get -r /D:/dipcatcher/tests
get -r /D:/dipcatcher/configs
get -r /D:/dipcatcher/scripts
get -r /D:/dipcatcher/docs
get /D:/dipcatcher/README.md
get /D:/dipcatcher/pyproject.toml
get /D:/dipcatcher/Makefile
get /D:/dipcatcher/.gitignore
bye
""".format(dest=DEST)
with tempfile.NamedTemporaryFile("w", delete=False, suffix=".sftp") as fh:
    fh.write(batch)
    path = fh.name
try:
    print(f"sftp pull D:\\dipcatcher -> {DEST}", flush=True)
    result = subprocess.run(
        ["sftp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20", "-b", path, "ah-remote"],
        check=False,
    )
    print("README", os.path.exists(os.path.join(DEST, "README.md")))
    print("ledger", os.path.exists(os.path.join(DEST, "src/quant_fund/paper/ledger.py")))
    sys.exit(0 if result.returncode == 0 else result.returncode)
finally:
    os.unlink(path)
