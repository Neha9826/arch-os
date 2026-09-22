# Firestore Rules Emulator Prerequisite

This repository now contains `firestore.rules`, but it does not yet include an
emulator test harness. Running rules integration tests requires a local Firebase
CLI/Firestore Emulator installation, Java, and a rules-test dependency such as
`@firebase/rules-unit-testing`.

Those tools are intentionally not installed by this milestone. When the project
adopts the emulator harness, run it only against local emulators and add tests
for anonymous, owner, non-owner, and forged-owner workspace and architecture
operations. Do not point rules tests at a deployed Firebase project.
