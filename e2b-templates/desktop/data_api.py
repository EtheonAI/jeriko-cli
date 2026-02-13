import json
import os
from pathlib import Path
from typing import Any, cast

import requests


class ApiClient:
    """
    A client class for making requests to an internal API aggregation platform.

    This class provides a simple interface to call APIs through an internal proxy service
    that aggregates multiple external APIs.
    """

    def __init__(self):
        """
        Initialize the API client with the base host URL for the proxy service.
        """
        host = os.getenv('RUNTIME_API_HOST', 'http://127.0.0.1:9330')
        self.host = f'{host}/apiproxy.v1.ApiProxyService/CallApi'
        with Path().home().joinpath('.secrets/sandbox_api_token').open('r') as f:
            self.token = f.read().strip()

    def _convert_bool_to_str(self, data: dict[str, Any] | None) -> dict[str, Any] | None:
        """Convert boolean values in dictionary to strings.

        Args:
            data (dict | None): Input dictionary that may contain boolean values

        Returns:
            dict | None: Dictionary with boolean values converted to strings, or None if input is None
        """
        if data is None:
            return None

        result: dict[str, Any] = {}
        for key, value in data.items():
            if isinstance(value, bool):
                result[key] = str(value).lower()
            elif isinstance(value, dict):
                result[key] = self._convert_bool_to_str(cast(dict[str, Any], value))
            else:
                result[key] = value
        return result

    def call_api(
        self,
        api_id_or_name: str,
        body: dict[str, Any] | None = None,
        query: dict[str, Any] | None = None,
        path_params: dict[str, Any] | None = None,
        multipart_form_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Make an API call through the proxy service.

        Args:
            api_id_or_name (str): The ID or name of the API to call
            body (dict, optional): The request body to send. Defaults to None.
            query (dict, optional): The query parameters to send. Defaults to None.
            path_params (dict, optional): The path parameters to send. Defaults to None.
            multipart_form_data (dict, optional): The multipart form data to send. Defaults to None.

        Returns:
            dict: The JSON response from the API call, or an error dict if the call fails
        """
        try:
            resp = requests.post(
                f'{self.host}',
                json={
                    'apiId': api_id_or_name,
                    'body': self._convert_bool_to_str(body),
                    'query': self._convert_bool_to_str(query),
                    'path_params': self._convert_bool_to_str(path_params),
                    'multipart_form_data': self._convert_bool_to_str(multipart_form_data),
                },
                headers={'x-sandbox-token': self.token},
            )
            data = resp.json()
            if 'jsonData' in data:
                return json.loads(data['jsonData'])
            else:
                return data
        except Exception as e:
            return {'error': str(e)}
