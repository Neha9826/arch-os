import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  test,
} from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";

let testEnv: RulesTestEnvironment;

const projectId = "demo-arch-os";

const userA = {
  uid: "user-a",
  email: "user-a@example.com",
};

const userB = {
  uid: "user-b",
  email: "user-b@example.com",
};

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";
const architectureA = "architecture-a";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(
        path.resolve(process.cwd(), "firestore.rules"),
        "utf8"
      ),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

function authenticatedDb(user: typeof userA) {
  return testEnv.authenticatedContext(user.uid, {
    email: user.email,
  }).firestore();
}

function unauthenticatedDb() {
  return testEnv.unauthenticatedContext().firestore();
}

describe("Workspace security rules", () => {
  test("unauthenticated user cannot create a workspace", async () => {
    const db = unauthenticatedDb();

    await assertFails(
      setDoc(doc(db, "workspaces", workspaceA), {
        ownerId: userA.uid,
        name: "User A Workspace",
      })
    );
  });

  test("user can create their own workspace", async () => {
    const db = authenticatedDb(userA);

    await assertSucceeds(
      setDoc(doc(db, "workspaces", workspaceA), {
        ownerId: userA.uid,
        name: "User A Workspace",
      })
    );
  });

  test("user cannot create a workspace owned by another user", async () => {
    const db = authenticatedDb(userA);

    await assertFails(
      setDoc(doc(db, "workspaces", workspaceB), {
        ownerId: userB.uid,
        name: "Forged Workspace",
      })
    );
  });

  test("user cannot read another user's workspace", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "workspaces", workspaceA),
        {
          ownerId: userA.uid,
          name: "User A Workspace",
        }
      );
    });

    const db = authenticatedDb(userB);

    await assertFails(
      getDoc(doc(db, "workspaces", workspaceA))
    );
  });

  test("user cannot change workspace ownership", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "workspaces", workspaceA),
        {
          ownerId: userA.uid,
          name: "User A Workspace",
        }
      );
    });

    const db = authenticatedDb(userA);

    await assertFails(
      updateDoc(doc(db, "workspaces", workspaceA), {
        ownerId: userB.uid,
      })
    );
  });
});

describe("Architecture security rules", () => {
  test("user can create an architecture in their own workspace", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "workspaces", workspaceA),
        {
          ownerId: userA.uid,
          name: "User A Workspace",
        }
      );
    });

    const db = authenticatedDb(userA);

    await assertSucceeds(
      setDoc(doc(db, "architectures", architectureA), {
        ownerId: userA.uid,
        workspaceId: workspaceA,
        name: "Architecture A",
        nodes: [],
        edges: [],
      })
    );
  });

  test("user cannot create an architecture in another user's workspace", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "workspaces", workspaceB),
        {
          ownerId: userB.uid,
          name: "User B Workspace",
        }
      );
    });

    const db = authenticatedDb(userA);

    await assertFails(
      setDoc(doc(db, "architectures", architectureA), {
        ownerId: userA.uid,
        workspaceId: workspaceB,
        name: "Forged Architecture",
        nodes: [],
        edges: [],
      })
    );
  });

  test("user cannot create an architecture with another user's ownerId", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "workspaces", workspaceA),
        {
          ownerId: userA.uid,
          name: "User A Workspace",
        }
      );
    });

    const db = authenticatedDb(userA);

    await assertFails(
      setDoc(doc(db, "architectures", architectureA), {
        ownerId: userB.uid,
        workspaceId: workspaceA,
        name: "Forged Architecture",
        nodes: [],
        edges: [],
      })
    );
  });

  test("user cannot read another user's architecture", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA),
        {
          ownerId: userA.uid,
          workspaceId: workspaceA,
          name: "Architecture A",
          nodes: [],
          edges: [],
        }
      );
    });

    const db = authenticatedDb(userB);

    await assertFails(
      getDoc(doc(db, "architectures", architectureA))
    );
  });

  test("user cannot change architecture ownership", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA),
        {
          ownerId: userA.uid,
          workspaceId: workspaceA,
          name: "Architecture A",
          nodes: [],
          edges: [],
        }
      );
    });

    const db = authenticatedDb(userA);

    await assertFails(
      updateDoc(doc(db, "architectures", architectureA), {
        ownerId: userB.uid,
      })
    );
  });
});

describe("Architecture branch security rules", () => {
  async function seedBranchSnapshot() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "workspaces", workspaceA), { ownerId: userA.uid, name: "User A Workspace" });
      await setDoc(doc(context.firestore(), "architectures", architectureA), { ownerId: userA.uid, workspaceId: workspaceA, name: "Architecture A", nodes: [], edges: [] });
      await setDoc(doc(context.firestore(), "architectures", architectureA, "snapshots", "snapshot-a"), snapshotData);
    });
  }

  const branchSnapshotData = {
    architectureId: architectureA,
    workspaceId: workspaceA,
    ownerId: userA.uid,
    createdBy: userA.uid,
    name: "Branch base",
    architectureIR: { schemaVersion: 1, components: [], relations: [] },
    canvasLayout: { nodes: [], edges: [] },
    message: "",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  async function seedBranchSnapshot() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "workspaces", workspaceA), {
        ownerId: userA.uid,
        name: "User A Workspace",
      });
      await setDoc(doc(context.firestore(), "architectures", architectureA), {
        ownerId: userA.uid,
        workspaceId: workspaceA,
        name: "Architecture A",
        nodes: [],
        edges: [],
      });
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "snapshots", "snapshot-a"),
        branchSnapshotData,
      );
    });
  }

  test("owner can create a branch from their snapshot", async () => {
    await seedBranchSnapshot();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "snapshots", "snapshot-a"),
        snapshotData,
      );
    });

    const db = authenticatedDb(userA);
    await assertSucceeds(
      setDoc(
        doc(db, "architectures", architectureA, "branches", "branch-a"),
        {
          architectureId: architectureA,
          workspaceId: workspaceA,
          ownerId: userA.uid,
          createdBy: userA.uid,
          name: "feature/payments",
          description: "Payment flow experiment",
          baseSnapshotId: "snapshot-a",
          status: "active",
          architectureIR: { schemaVersion: 1, components: [], relations: [] },
          canvasLayout: { nodes: [], edges: [] },
        },
      ),
    );
  });

  test("user cannot create a branch from another user's architecture or snapshot", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "workspaces", workspaceB), {
        ownerId: userB.uid,
        name: "User B Workspace",
      });
      await setDoc(doc(context.firestore(), "architectures", "architecture-b"), {
        ownerId: userB.uid,
        workspaceId: workspaceB,
        name: "Architecture B",
        nodes: [],
        edges: [],
      });
      await setDoc(
        doc(context.firestore(), "architectures", "architecture-b", "snapshots", "snapshot-b"),
        {
          ...branchSnapshotData,
          architectureId: "architecture-b",
          workspaceId: workspaceB,
          ownerId: userB.uid,
          createdBy: userB.uid,
        },
      );
    });

    const db = authenticatedDb(userA);
    await assertFails(
      setDoc(
        doc(db, "architectures", "architecture-b", "branches", "branch-a"),
        {
          architectureId: "architecture-b",
          workspaceId: workspaceB,
          ownerId: userA.uid,
          createdBy: userA.uid,
          name: "forged",
          baseSnapshotId: "snapshot-b",
          status: "active",
          architectureIR: { schemaVersion: 1, components: [], relations: [] },
          canvasLayout: { nodes: [], edges: [] },
        },
      ),
    );
  });

  test("branch owner can update working state but cannot change its base", async () => {
    await seedBranchSnapshot();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "snapshots", "snapshot-a"),
        snapshotData,
      );
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "branches", "branch-a"),
        {
          architectureId: architectureA,
          workspaceId: workspaceA,
          ownerId: userA.uid,
          createdBy: userA.uid,
          name: "feature/payments",
          description: "",
          baseSnapshotId: "snapshot-a",
          status: "active",
          architectureIR: { schemaVersion: 1, components: [], relations: [] },
          canvasLayout: { nodes: [], edges: [] },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
    });

    const db = authenticatedDb(userA);
    const branchRef = doc(db, "architectures", architectureA, "branches", "branch-a");
    await assertSucceeds(
      updateDoc(branchRef, {
        name: "feature/payments-v2",
        description: "Updated",
        status: "active",
        architectureIR: { schemaVersion: 1, components: [], relations: [] },
        canvasLayout: { nodes: [], edges: [] },
      }),
    );
    await assertFails(
      updateDoc(branchRef, {
        baseSnapshotId: "another-snapshot",
      }),
    );
  });

  test("another user cannot read, update, or delete a branch", async () => {
    await seedBranchSnapshot();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "branches", "branch-a"),
        {
          architectureId: architectureA,
          workspaceId: workspaceA,
          ownerId: userA.uid,
          createdBy: userA.uid,
          name: "feature/payments",
          description: "",
          baseSnapshotId: "snapshot-a",
          status: "active",
          architectureIR: { schemaVersion: 1, components: [], relations: [] },
          canvasLayout: { nodes: [], edges: [] },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
    });

    const db = authenticatedDb(userB);
    const branchRef = doc(db, "architectures", architectureA, "branches", "branch-a");
    await assertFails(getDoc(branchRef));
    await assertFails(updateDoc(branchRef, {
      name: "forged",
      description: "",
      status: "active",
      architectureIR: { schemaVersion: 1, components: [], relations: [] },
      canvasLayout: { nodes: [], edges: [] },
    }));
    await assertFails(deleteDoc(branchRef));
  });

});

describe("Architecture snapshot security rules", () => {
  async function seedArchitecture() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "workspaces", workspaceA), {
        ownerId: userA.uid,
        name: "User A Workspace",
      });
      await setDoc(doc(context.firestore(), "architectures", architectureA), {
        ownerId: userA.uid,
        workspaceId: workspaceA,
        name: "Architecture A",
        nodes: [],
        edges: [],
      });
    });
  }

  const snapshotData = {
    architectureId: architectureA,
    workspaceId: workspaceA,
    ownerId: userA.uid,
    createdBy: userA.uid,
    name: "Before refactor",
    architectureIR: { schemaVersion: 1, components: [], relations: [] },
    canvasLayout: { nodes: [], edges: [] },
    message: "",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  test("owner can create a snapshot for their architecture", async () => {
    await seedArchitecture();
    const db = authenticatedDb(userA);
    await assertSucceeds(
      setDoc(doc(db, "architectures", architectureA, "snapshots", "snapshot-a"), snapshotData),
    );
  });

  test("another user cannot read or create snapshots", async () => {
    await seedArchitecture();
    const db = authenticatedDb(userB);
    await assertFails(
      getDoc(doc(db, "architectures", architectureA, "snapshots", "snapshot-a")),
    );
    await assertFails(
      setDoc(doc(db, "architectures", architectureA, "snapshots", "snapshot-a"), {
        ...snapshotData,
        ownerId: userB.uid,
        createdBy: userB.uid,
      }),
    );
  });

  test("owner can edit snapshot metadata but cannot change its saved contents", async () => {
    await seedArchitecture();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "snapshots", "snapshot-a"),
        snapshotData,
      );
    });
    const db = authenticatedDb(userA);
    const snapshotRef = doc(db, "architectures", architectureA, "snapshots", "snapshot-a");
    await assertSucceeds(
      updateDoc(snapshotRef, { name: "Renamed snapshot", message: "Updated note" }),
    );
    await assertFails(
      updateDoc(snapshotRef, {
        name: "Tampered snapshot",
        message: "Changed content",
        architectureIR: { schemaVersion: 1, components: [], relations: [{ id: "forged" }] },
      }),
    );
  });

  test("owner can delete a snapshot", async () => {
    await seedArchitecture();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "snapshots", "snapshot-a"),
        snapshotData,
      );
    });
    const db = authenticatedDb(userA);
    await assertSucceeds(
      deleteDoc(doc(db, "architectures", architectureA, "snapshots", "snapshot-a")),
    );
  });

  test("another user cannot edit or delete a snapshot", async () => {
    await seedArchitecture();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "snapshots", "snapshot-a"),
        snapshotData,
      );
    });
    const db = authenticatedDb(userB);
    const snapshotRef = doc(db, "architectures", architectureA, "snapshots", "snapshot-a");
    await assertFails(updateDoc(snapshotRef, { name: "Unauthorized", message: "" }));
    await assertFails(deleteDoc(snapshotRef));
  });
});
