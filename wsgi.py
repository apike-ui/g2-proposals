import sys
import os

# Tell Python where to find the app
project_home = os.path.dirname(os.path.abspath(__file__))
if project_home not in sys.path:
    sys.path.insert(0, project_home)

from proposals_server import app as application
