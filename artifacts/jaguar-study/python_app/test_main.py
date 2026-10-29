import unittest

from fastapi.testclient import TestClient

from main import app


class JaguarAppTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check_is_available(self):
        response = self.client.get("/healthz")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_home_renders_the_python_study_workspace(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Use your notes to study well", response.text)
        self.assertIn("Let’s get ready.", response.text)
        self.assertIn("Exam planner", response.text)
        self.assertIn("Study activity", response.text)
        self.assertIn('data-accent="violet"', response.text)

    def test_static_assets_are_served(self):
        response = self.client.get("/static/app.js")

        self.assertEqual(response.status_code, 200)
        self.assertIn("study/generate", response.text)


if __name__ == "__main__":
    unittest.main()
