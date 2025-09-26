# Preparation of API Documentation for the MCP Server

The script `prepare_api_docs.py` read API documentation from the Web
and collects it in a single yaml file, which is then used by an MCP 
tool to provide API documentation to an LLM on demand.

## Prerequisites

Pixi is used for environment management.

Install the environment via:

    pixi install

## Running the Script

To run the script, use:

    pixi run python prepare_api_docs.py

This will generate `../mcp-server/data/api_types.yml`.