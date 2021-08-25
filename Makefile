# Main targets:
#   * install: Install Python virtual environment and project dependencies
#   * test: Run all checks on project resources
#   * serve: Start local server 
	
check-prerequisites:
	@if ! which node npm yarn python3 > /dev/null 2>&1 \
			|| ! python3 -m venv --help > /dev/null 2>&1; then \
		echo -n 'Please ensure the following prerequisites are installed:\n' \
			'  * Node.js (https://github.com/nvm-sh/nvm)\n' \
			'  * npm (comes with Node.js)\n' \
			'  * Yarn (npm install --global yarn)' \
			'  * Python 3.x (apt install python3)\n' \
			'  * Python venv module (apt install python3-venv)\n' 1>&2; \
		exit 1; \
	fi

install: install-yarn install-venv

install-venv: check-prerequisites
	python3 -m venv --prompt "$$(pwd | rev | cut -d / -f 1 | rev)" .venv
	. .venv/bin/activate; pip install -Ur requirements.txt

install-yarn: check-prerequisites
	yarn install
	make install-prettier

install-prettier: check-prerequisites
	yarn add --dev --exact prettier

serve: 
	. .venv/bin/activate && mkdocs serve -f mkdocs.yml

.PHONY: \
	check-prerequisites \
	install \
	install-venv \
	install-yarn \
	install-prettier \
	serve 
