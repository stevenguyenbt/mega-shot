@echo off
rem mega-shot · xp — command-line video studio (needs uv and ffmpeg)
uv run --quiet --no-project --with playwright==1.63.0 --with pyyaml --with pillow --with numpy --with ruamel.yaml python "%~dp0tools\xp.py" %*
