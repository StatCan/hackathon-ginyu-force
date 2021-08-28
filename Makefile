# Main targets:
#   * install: Install Python virtual environment and project dependencies
#   * serve: Start local server 
	
check-prerequisites:
	@if ! which python3 > /dev/null 2>&1 \
			|| ! python3 -m venv --help > /dev/null 2>&1; then \
		echo -n 'Please ensure the following prerequisites are installed:\n' \
			'  * Python 3.x (apt install python3)\n' \
			'  * Python venv module (apt install python3-venv)\n' 1>&2; \
		exit 1; \
	fi

install: install-venv

install-venv: check-prerequisites
	python3 -m venv --prompt "$$(pwd | rev | cut -d / -f 1 | rev)" .venv
	. .venv/bin/activate; pip install -Ur requirements.txt

serve: 
	. .venv/bin/activate && python3 -m http.server --b 127.0.0.1 8080 -d site/

.PHONY: \
	check-prerequisites \
	install \
	install-venv \
	serve 
