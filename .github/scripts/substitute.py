#!/bin/python3

import os
import json
from argparse import ArgumentParser
from typing import Dict
import jinja2
from jinja2 import Template, FileSystemLoader, StrictUndefined

jinja_env = jinja2.Environment(
    loader=FileSystemLoader('.'),
    undefined=StrictUndefined
)

ROOT = 'assets'
PRINT_ONLY = False

def templatify(dest: str, values: Dict):
    try:
        template = jinja_env.get_template(dest)
    except UnicodeDecodeError:
        return

    s = template.render(**values)
    if PRINT_ONLY:
        print(s)
    else:
        with open(dest, 'w') as f:
            f.write(s)

def traverse(values, dir=ROOT):
    # Copy and template everything!
    for (dirpath, dirnames, filenames) in os.walk(dir):
        for filename in filenames:
            fullname = os.sep.join([dirpath, filename])
            templatify(fullname, values)


if __name__ == "__main__":
    parser = ArgumentParser(description='Template variables with jinja')
    parser.add_argument(
        'file',
        type=str,
        help='A .json file to read substitutions from'
       )

    # Get json data to subsititute
    args = parser.parse_args()
    with open(args.file) as f:
        values = json.load(f)

    traverse(values)
