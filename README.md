## Assignment 3

### How to run project
#### Setup
Install uv package manager, [instructions here](https://docs.astral.sh/uv/getting-started/installation/)



#### For Production
`uv run init.py`
#### For Development (Hot-reload)
`uv run uvicorn init:app --reload`\
Note: Swagger api page is available at the `\docs` endpoint

## Admin + Login Frontend

This part implements the login interface and administrator dashboard for the 2FA chess system. The login page checks the username, password, and keygen account status before allowing a user to continue to continue to the two-factor authentication step.
The admin dashboard supports adding user, deleting users, and enabling or disabling keygen account. Frontend validation is also included, such as duplicate username checking and a safeguard that prevents the current admin account from beging deleted.
After successful 2FA validation, admin users are redirected to the admin dashboard, while normal users are redirected to the chess access page. 