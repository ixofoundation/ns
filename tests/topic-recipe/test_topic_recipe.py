"""Offline JSON-LD interoperability tests using pinned W3C context snapshots."""
import copy
import hashlib
import json
from pathlib import Path
import unittest

from jsonschema import Draft202012Validator, FormatChecker
from pyld import jsonld

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
VC = "https://www.w3.org/2018/credentials#"
IXO = "https://w3id.org/ixo/vocab/v1#"
CONTEXT_URL = "https://w3id.org/ixo/context/v1/topic-recipe/index.jsonld"
SCHEMA_URL = "https://w3id.org/ixo/schema/v1/topic-recipe-domain-card"
PATHS = {
    "https://www.w3.org/ns/credentials/v2": HERE / "contexts/credentials-v2.jsonld",
    "https://www.w3.org/ns/did/v1": HERE / "contexts/did-v1.jsonld",
    "https://w3id.org/ixo/context/v1": ROOT / "context/v1/index.jsonld",
    CONTEXT_URL: ROOT / "context/v1/topic-recipe/index.jsonld",
}


def read(path):
    return json.loads(path.read_text())


def loader(url, options=None):
    if url not in PATHS:
        raise ValueError("Unpinned remote context: " + url)
    return {"contextUrl": None, "documentUrl": url, "document": read(PATHS[url])}


def example(name="public"):
    return read(ROOT / f"vocab/v1/topic-recipe/{name}.example.jsonld")


def expand(card):
    return jsonld.expand(card, {"documentLoader": loader})


def canonical(card):
    return jsonld.normalize(card, {"algorithm": "URDNA2015", "format": "application/n-quads", "documentLoader": loader})


class TopicRecipeTests(unittest.TestCase):
    def assert_field_validity(self, path, value, valid):
        card = example("private")
        target = card
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value
        validator = Draft202012Validator(
            read(ROOT / "schema/v1/topic-recipe-domain-card.json"),
            format_checker=FormatChecker(),
        )
        self.assertEqual(validator.is_valid(card), valid, (path, value))

    def test_required_format_validators_are_installed(self):
        checker = FormatChecker()
        for name in ("uri", "date-time"):
            self.assertIn(name, checker.checkers)

    def test_invalid_dates_and_source_uris_are_rejected(self):
        self.assert_field_validity(("validFrom",), "not-a-date", False)
        card = example("private")
        card["credentialSubject"]["topicRecipe"]["sources"] = [{
            "role": "protocol-core", "id": "not a uri", "version": "1.0.0",
            "digest": "sha256:" + "0" * 64,
        }]
        validator = Draft202012Validator(
            read(ROOT / "schema/v1/topic-recipe-domain-card.json"),
            format_checker=FormatChecker(),
        )
        self.assertFalse(validator.is_valid(card))
        card["credentialSubject"]["topicRecipe"]["sources"][0]["id"] = "https://example.org/source"
        validator.validate(card)

    def test_did_grammar_at_every_identity_location(self):
        subject = ("credentialSubject",)
        resource = subject + ("topicRecipe", "shapeResource")
        locations = [
            (("id",), "#dmn"),
            (("issuer", "id"), ""),
            (subject + ("id",), ""),
            (subject + ("relatedDocument", 0, "id"), "#top-01"),
            (resource + ("id",), "#top-01"),
            (resource + ("access", "delegation", "authority"), ""),
        ]
        for path, fragment in locations:
            for did in ("did:ixo:", "did:ixo::", "did:ixo:abc:", "did:ixo:a%",
                        "did:ixo:a%G0", "did:ixo:a@b", "did:ixo:a/b", "did:ixo:a?b",
                        "did:ixo:a#b", "did:ixo:café", "did:IXO:abc", "did:ixo:a b"):
                with self.subTest(path=path, did=did):
                    self.assert_field_validity(path, did + fragment, False)
            for did in ("did:ixo:abc", "did:example:network:Abc.1_-", "did:example::abc",
                        "did:example:a%20b", "did:example:%3A"):
                with self.subTest(path=path, did=did):
                    self.assert_field_validity(path, did + fragment, True)
            with self.subTest(path=path, trailing_newline=True):
                self.assert_field_validity(path, "did:ixo:abc" + fragment + "\n", False)

    def test_delegation_endpoint_requires_https_host(self):
        path = ("credentialSubject", "topicRecipe", "shapeResource", "access",
                "delegation", "requestEndpoint")
        for endpoint in ("https://", "https:///request", "https://?request=1", "https://#request",
                         "https://:443/request", "https://[]/request", "https:// /request",
                         "http://example.org/request", "https://user:secret@example.org/request",
                         "https://example.org/request\n"):
            with self.subTest(endpoint=endpoint):
                self.assert_field_validity(path, endpoint, False)
        for endpoint in ("https://example.org", "https://example.org:8443/request?recipe=1",
                         "https://127.0.0.1/request", "https://[::1]:8443/request"):
            with self.subTest(endpoint=endpoint):
                self.assert_field_validity(path, endpoint, True)

    def test_pinned_dependencies_and_unchanged_shared_context(self):
        for item in read(HERE / "contexts/provenance.json")["documents"]:
            self.assertEqual(hashlib.sha256((ROOT / item["path"]).read_bytes()).hexdigest(), item["sha256"])

    def test_public_and_private_cards_match_schema(self):
        schema = read(ROOT / "schema/v1/topic-recipe-domain-card.json")
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        for name in ("public", "private"):
            validator.validate(example(name))

    def test_domain_card_and_entity_types_expand_canonically(self):
        card = expand(example())[0]
        self.assertIn(VC + "VerifiableCredential", card["@type"])
        self.assertIn(IXO + "DomainCard", card["@type"])
        self.assertEqual(card[VC + "credentialSubject"][0]["@type"], [IXO + "protocol/topic"])
        self.assertEqual(card[VC + "credentialSchema"][0]["@id"], SCHEMA_URL)

    def test_full_recipe_json_survives_expansion(self):
        for name in ("public", "private"):
            original = example(name)
            subject = expand(original)[0][VC + "credentialSubject"][0]
            self.assertEqual(subject[IXO + "topicRecipe"], [
                {"@type": "@json", "@value": original["credentialSubject"]["topicRecipe"]}])

    def test_compaction_preserves_private_access_metadata(self):
        original = example("private")
        compacted = jsonld.compact(expand(original), original["@context"], {"documentLoader": loader})
        self.assertEqual(compacted["credentialSubject"]["topicRecipe"], original["credentialSubject"]["topicRecipe"])

    def test_discovery_fields_image_and_fragment_are_in_rdf(self):
        subject = expand(example())[0][VC + "credentialSubject"][0]
        for term in ("purpose", "function", "systemRole"):
            self.assertIn(IXO + term, subject)
        self.assertIn("https://schema.org/name", subject)
        self.assertIn("http://schema.org/keywords", subject)
        self.assertIn("http://schema.org/logo", subject)
        related = subject["http://schema.org/subjectOf"][0]
        self.assertTrue(related["@id"].endswith("#top-01"))
        self.assertEqual(related["https://schema.org/encodingFormat"], [{"@value": "application/json"}])

    def test_any_nested_recipe_change_changes_canonical_dataset(self):
        original = example("private")
        before = canonical(original)
        changed = copy.deepcopy(original)
        changed["credentialSubject"]["topicRecipe"]["shapeResource"]["access"]["delegation"]["authority"] = "did:ixo:other"
        self.assertNotEqual(before, canonical(changed))
        self.assertIn("http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON", before)

    def test_object_key_order_does_not_change_canonical_dataset(self):
        original = example()
        changed = copy.deepcopy(original)
        meta = changed["credentialSubject"]["topicRecipe"]
        changed["credentialSubject"]["topicRecipe"] = dict(reversed(list(meta.items())))
        self.assertEqual(canonical(original), canonical(changed))

    def test_protected_recipe_term_cannot_be_silently_redefined(self):
        card = example()
        card["@context"].append({"topicRecipe": {"@id": "https://example.org/other", "@type": "@json"}})
        with self.assertRaises(jsonld.JsonLdError):
            expand(card)

    def test_legacy_inline_alias_requires_reissuance(self):
        card = example()
        card["@context"].insert(1, {"@protected": True, "topicRecipe": {
            "@id": "https://github.com/ixoworld/topic-protocol/ns/topic-recipe/v1#topicRecipe", "@type": "@json"}})
        with self.assertRaises(jsonld.JsonLdError):
            expand(card)

    def test_schema_rejects_invalid_fragment_paywall_and_base_recipe(self):
        validator = Draft202012Validator(read(ROOT / "schema/v1/topic-recipe-domain-card.json"), format_checker=FormatChecker())
        bad = example(); bad["credentialSubject"]["topicRecipe"]["baseRecipe"] = "task"
        self.assertFalse(validator.is_valid(bad))
        bad = example(); bad["credentialSubject"]["topicRecipe"]["shapeResource"]["id"] = "did:ixo:test#top-00"
        self.assertFalse(validator.is_valid(bad))
        bad = example("private"); bad["credentialSubject"]["topicRecipe"]["shapeResource"]["access"]["paywall"]["status"] = "active"
        self.assertFalse(validator.is_valid(bad))

    def test_vocabulary_defines_all_ixo_terms_used_by_new_context(self):
        graph = read(ROOT / "vocab/v1/topic-recipe/index.jsonld")["@graph"]
        defined = {item["@id"] for item in graph}
        for term in ("DomainCard", "TopicRecipe", "protocol/topic", "topicRecipe", "purpose", "function", "systemRole"):
            self.assertIn(IXO + term, defined)
        imports = read(ROOT / "vocab/v1/index.jsonld")["@graph"][0]["owl:imports"]
        self.assertIn({"@id": "https://w3id.org/ixo/vocab/v1/constitution"}, imports)

    def test_no_unpinned_remote_context_is_fetched(self):
        card = example(); card["@context"].append("https://example.org/untrusted")
        with self.assertRaises(jsonld.JsonLdError):
            expand(card)


if __name__ == "__main__":
    unittest.main()
