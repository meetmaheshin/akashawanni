#!/bin/bash
cd "$(dirname "$0")"
# Use system python3 with user site-packages
exec python3 main.py
