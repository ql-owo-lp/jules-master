
import pytest
import os

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "base_url": "http://localhost:9002",
        "viewport": {
            "width": 1280,
            "height": 720,
        }
    }

@pytest.fixture(scope="function")
def context(context):
    # Set default timeout
    context.set_default_timeout(10000)
    yield context

@pytest.fixture(scope="session", autouse=True)
def start_server():
    # Placeholder for server start logic, if we were to automate it.
    # Currently we rely on external process or CI to start the server.
    pass
