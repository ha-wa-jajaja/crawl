{ pkgs, ... }: {
  # Set the Nix channel for package versions
  channel = "stable-24.05";

  # Define the packages to install in the environment
  packages = [
    pkgs.nodejs_20 # For the Node.js backend
    pkgs.python3 # For the Python crawling logic
    pkgs.python3Packages.requests # For making HTTP requests in Python
    pkgs.python3Packages.beautifulsoup4 # For parsing HTML in Python
    pkgs.python3Packages.google-cloud-firestore # For interacting with Firestore from Python (optional for now)
  ];

  # Configure workspace settings
  idx = {
    # Define VS Code extensions to install
    extensions = [
      "dbaeumer.vscode-eslint" # Linter for JavaScript
      "ms-python.python" # Python extension
    ];

    # Define workspace lifecycle hooks
    workspace = {
      # Commands to run when the workspace is first created
      onCreate = {
        # Install Node.js dependencies in the backend directory
        "npm-install-backend" = "npm install --prefix backend";
      };
      # Commands to run every time the workspace is (re)started
      onStart = {
        # Start the backend server
        "start-backend" = "npm start --prefix backend";
      };
    };

    # Configure web previews (optional, but useful for the frontend)
    # You might configure this later once you have a frontend server
    # previews = {
    #   enable = true;
    #   previews = {
    #     web = {
    #       command = ["npm" "start" "--prefix" "frontend" "--" "--port" "$PORT"];
    #       manager = "web";
    #     };
    #   };
    # };
  };
}
