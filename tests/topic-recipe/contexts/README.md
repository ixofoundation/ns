# Pinned test contexts

The unmodified `credentials-v2.jsonld` and `did-v1.jsonld` snapshots were fetched
from their official W3C URLs recorded in [provenance.json](provenance.json).
They are test dependencies, not republished replacement context URLs. W3C source
terms apply; see [W3C document and software licensing](https://www.w3.org/copyright/).

The provenance file also pins the existing shared IXO context to demonstrate
that the Topic Recipe profile does not change it. Tests load that file directly
from the repository. Updating a standard snapshot or the shared context requires
reviewing its semantic effect and deliberately updating this test pin.
