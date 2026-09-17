"""Offline regression checks for the separate historical aliases and artifacts."""
import copy
import json
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

from historical_guide_redirects import (
    MANIFEST, JSON_ARTIFACT, CSV_ARTIFACT, build_artifact, validate_historical_redirects,
)
from cloudflare_redirects import ORIGIN, csv_lines_from_items
from redirects import RedirectManifestError
from url_map import build_url_map

ROOT = Path(__file__).resolve().parents[1]


class HistoricalRedirectTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / MANIFEST).read_text())
        self.primary = json.loads((ROOT / 'config/redirects.json').read_text())
        self.url_map = build_url_map(ROOT)

    def validate(self):
        return validate_historical_redirects(self.data, self.primary, self.url_map)

    def test_artifacts_and_canonical_destinations(self):
        artifact = build_artifact(self.data, self.primary, self.url_map)
        self.assertTrue(artifact['activated'])
        self.assertEqual(artifact, json.loads((ROOT / JSON_ARTIFACT).read_text()))
        self.assertEqual('\n'.join(csv_lines_from_items(artifact['items'])) + '\n',
                         (ROOT / CSV_ARTIFACT).read_text())
        locs = [e.text for e in ET.parse(ROOT / 'sitemap.xml').findall('{*}url/{*}loc')]
        self.assertEqual(len(locs), len(set(locs)))
        sources = {x['source_url'] for x in artifact['items']}
        self.assertEqual(len(sources), 8)
        for item in artifact['items']:
            self.assertEqual(item['status_code'], 301)
            self.assertTrue(item['preserve_query_string'])
            for flag in ('include_subdomains', 'subpath_matching', 'preserve_path_suffix'):
                self.assertFalse(item[flag])
            self.assertNotIn(item['source_url'], locs)
            self.assertIn(item['target_url'], locs)
            self.assertNotIn(item['target_url'], sources)
            html = (ROOT / urlsplit(item['target_url']).path.strip('/') / 'index.html').read_text()
            self.assertIn(f'rel="canonical" href="{item["target_url"]}"', html)

    def test_rejects_missing_duplicate_unknown_and_wrong_targets(self):
        baseline = copy.deepcopy(self.data)
        mutations = [
            lambda rows: rows.pop(),
            lambda rows: rows.append(copy.deepcopy(rows[0])),
            lambda rows: rows.__setitem__(1, copy.deepcopy(rows[0])),
            lambda rows: rows[0].update({'from': '/guide/*'}),
            lambda rows: rows[0].update({'from': '/guide/en/unrelated/'}),
            lambda rows: rows[0].update({'to': rows[2]['to']}),
            lambda rows: rows[2].update({'to': '/guides/optimai-cli-node-setup-guide-ubuntu-24-04-vps/TR/'}),
            lambda rows: rows[0].update({'to': rows[0]['from']}),
            lambda rows: rows[0].update({'to': 'https://example.com/'}),
        ]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                self.data = copy.deepcopy(baseline)
                mutate(self.data['redirects'])
                with self.assertRaises(RedirectManifestError): self.validate()

    def test_primary_validation_not_weakened(self):
        self.primary['redirects'].append(copy.deepcopy(self.primary['redirects'][0]))
        with self.assertRaises(RedirectManifestError): self.validate()

    def test_exact_match_resolution_model_preserves_queries(self):
        # Model the prepared exact-match rules, not Cloudflare's deployed runtime.
        items = build_artifact(self.data, self.primary, self.url_map)['items']
        def resolve(url):
            path, sep, query = url.partition('?')
            for item in items:
                if item['source_url'] == path:
                    return item['status_code'], item['target_url'] + (sep + query if item['preserve_query_string'] else '')
            return None
        for item in items:
            for query in ('', '?utm_source=gsc&x=one%2Ftwo&x=3&empty='):
                self.assertEqual(resolve(item['source_url'] + query), (301, item['target_url'] + query))
            self.assertIsNone(resolve(item['target_url']))
            self.assertIsNone(resolve(item['source_url'].rstrip('/') + '/child/'))
        self.assertIsNone(resolve(ORIGIN + '/guide/tr/unknown/'))


if __name__ == '__main__':
    unittest.main()
