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

This part implements the login interface and administrator dashboard for the 2FA chess system. The login page checks the username, password, and keygen account status before allowing the user to continue to the two-factor authentication step.

The admin dashboard supports adding users, deleting users, and enabling or disabling a user's keygen account. Basic frontend validation is also included, such as duplicate username checking and preventing the current admin account from being deleted.

After successful 2FA validation, admin users are redirected to the admin dashboard, while normal users are redirected to the chess access page.


### Demo Notes

For the demo, use the following account:

- Username: `admin`
- Password: `admin123`

If the admin account already exists and already has a 2FA secret, Step 1 and Step 2 do not need to be repeated. The main demo flow is:

1. Log in as admin.
2. Generate the temporary 2FA code.
3. Validate the code within 15 seconds.
4. Open the admin dashboard.
5. Test add, disable, enable, and delete user functions.

#### Using Fastapi Dev
`uv run fastapi dev`
Works due to fastapi entrypoint override in pyproject.toml

To see docs go to (http://127.0.0.1:8000/docs) after running

#### Usage
Click on the debug_admin_token function and execute, you will get an access token back. Copy it.
![DEBUG Path](docs/images/image.png)
Click on the Authorize button on the top right of the page and paste the copy pasted value.\
![alt text](docs/images/image2.png)\
You should be logged in now  👍 \
Try it on the get users endpoint and you should get detailed results\
