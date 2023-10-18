#!/bin/bash

python3 ./code/fetch-data.py

python3 ./code/generate-gantt.py -s conf
