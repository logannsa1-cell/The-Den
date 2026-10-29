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
        self.assertIn("Use your notes to study ", response.text)
        self.assertIn('<em class="editorial-accent">well</em>', response.text)
        self.assertIn('Get ready for <em class="editorial-accent">exam day.</em>', response.text)
        self.assertIn("How much should I upload?", response.text)
        self.assertIn("Around 10,000 words", response.text)
        self.assertIn("180,000 characters combined", response.text)
        self.assertIn('id="source-character-meter"', response.text)
        self.assertIn("Exam planner", response.text)
        self.assertIn("Study activity", response.text)
        self.assertIn('data-view="saved"', response.text)
        self.assertIn('id="saved-page-list"', response.text)
        self.assertNotIn('id="home-saved-list"', response.text)
        self.assertIn('data-accent="violet"', response.text)
        self.assertNotIn('target="_blank"', response.text)
        self.assertIn('id="mode-dialog"', response.text)
        self.assertIn('id="choose-formats-button"', response.text)
        self.assertIn('id="select-all-modes"', response.text)
        self.assertNotIn('id="mode-heading">Create a study set', response.text)
        self.assertIn('id="streak-count"', response.text)
        self.assertIn('id="reminder-time"', response.text)
        self.assertIn('href="/static/jaguar-outline.svg"', response.text)

    def test_static_assets_are_served(self):
        response = self.client.get("/static/app.js")

        self.assertEqual(response.status_code, 200)
        self.assertIn("study/generate", response.text)
        self.assertIn("function combinedSourceText()", response.text)
        self.assertIn("aria-valuetext", response.text)
        self.assertIn("MAX_SOURCE_CHARS = 180000", response.text)
        self.assertIn("function maybeOpenModeDialog()", response.text)
        self.assertIn("function renderStudyStreak()", response.text)
        self.assertIn("function scheduleReminder()", response.text)

        icon = self.client.get("/static/jaguar-outline.svg")
        self.assertEqual(icon.status_code, 200)
        self.assertIn("<svg", icon.text)


if __name__ == "__main__":
    unittest.main()
