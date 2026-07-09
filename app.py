"""Flask reimplementation of the Node.js server (server.js)."""

from flask import Flask, Response

app = Flask(__name__)


@app.route(
    '/',
    defaults={'path': ''},
    methods=['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    provide_automatic_options=False,
)
@app.route(
    '/<path:path>',
    methods=['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    provide_automatic_options=False,
)
def catch_all(path):
    return Response('Hello, World!\n', status=200, content_type='text/plain')


if __name__ == '__main__':
    print('Server running at http://127.0.0.1:3000/')
    app.run(host='127.0.0.1', port=3000, debug=False, use_reloader=False)
