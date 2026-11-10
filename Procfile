prod: hypercorn server:app --bind 0.0.0.0:${PORT:-5000}

dev: hypercorn server:app --bind 127.0.0.1:5000 --reload --debug
