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
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
  writeBatch,
  serverTimestamp,
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
        branchSnapshotData,
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
        branchSnapshotData,
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

  test("owner can close an active branch but cannot mutate it after closing", async () => {
    await seedBranchSnapshot();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "branches", "branch-a"),
        {
          architectureId: architectureA,
          workspaceId: workspaceA,
          ownerId: userA.uid,
          createdBy: userA.uid,
          name: "feature/lifecycle",
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

    await assertSucceeds(updateDoc(branchRef, {
      name: "feature/lifecycle",
      description: "",
      status: "abandoned",
      architectureIR: { schemaVersion: 1, components: [], relations: [] },
      canvasLayout: { nodes: [], edges: [] },
    }));

    await assertFails(updateDoc(branchRef, {
      name: "reopened",
      description: "",
      status: "active",
      architectureIR: { schemaVersion: 1, components: [], relations: [] },
      canvasLayout: { nodes: [], edges: [] },
    }));

    await assertFails(updateDoc(branchRef, {
      name: "tampered",
      description: "",
      status: "abandoned",
      architectureIR: { schemaVersion: 1, components: [], relations: [] },
      canvasLayout: { nodes: [], edges: [] },
    }));

    await assertFails(deleteDoc(branchRef));
  });

  test("owner cannot modify or delete a merged branch", async () => {
    await seedBranchSnapshot();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "branches", "branch-a"),
        {
          architectureId: architectureA,
          workspaceId: workspaceA,
          ownerId: userA.uid,
          createdBy: userA.uid,
          name: "feature/merged",
          description: "",
          baseSnapshotId: "snapshot-a",
          status: "merged",
          architectureIR: { schemaVersion: 1, components: [], relations: [] },
          canvasLayout: { nodes: [], edges: [] },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
    });

    const db = authenticatedDb(userA);
    const branchRef = doc(db, "architectures", architectureA, "branches", "branch-a");
    await assertFails(updateDoc(branchRef, {
      name: "tampered",
      description: "",
      status: "merged",
      architectureIR: { schemaVersion: 1, components: [], relations: [] },
      canvasLayout: { nodes: [], edges: [] },
    }));
    await assertFails(deleteDoc(branchRef));
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


describe("Architecture commit security rules", () => {
  const commitData = {
    architectureId: architectureA,
    workspaceId: workspaceA,
    ownerId: userA.uid,
    createdBy: userA.uid,
    message: "Initial baseline",
    architectureIR: { schemaVersion: 1, components: [], relations: [] },
    canvasLayout: { nodes: [], edges: [] },
  };

  async function seedCommitArchitecture() {
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
        architectureIR: { schemaVersion: 1, components: [], relations: [] },
        canvasLayout: { nodes: [], edges: [] },
      });
    });
  }

  test("owner can create the root commit only when it atomically becomes Main head", async () => {
    await seedCommitArchitecture();
    const db = authenticatedDb(userA);
    const commitRef = doc(db, "architectures", architectureA, "commits", "commit-a");
    const architectureRef = doc(db, "architectures", architectureA);
    const batch = writeBatch(db);

    batch.set(commitRef, {
      ...commitData,
      createdAt: serverTimestamp(),
    });
    batch.update(architectureRef, {
      headCommitId: "commit-a",
    });

    await assertSucceeds(batch.commit());
  });

  test("a commit cannot be created without atomically advancing Main head", async () => {
    await seedCommitArchitecture();
    const db = authenticatedDb(userA);

    await assertFails(
      setDoc(
        doc(db, "architectures", architectureA, "commits", "commit-a"),
        {
          ...commitData,
          createdAt: serverTimestamp(),
        },
      ),
    );
  });

  test("owner cannot forge Main head to an existing commit outside a commit creation transaction", async () => {
    await seedCommitArchitecture();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "commits", "commit-a"),
        {
          ...commitData,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
    });

    const db = authenticatedDb(userA);
    await assertFails(
      updateDoc(doc(db, "architectures", architectureA), {
        headCommitId: "commit-a",
      }),
    );
  });

  test("another user cannot advance or create architecture history", async () => {
    await seedCommitArchitecture();
    const db = authenticatedDb(userB);

    await assertFails(
      updateDoc(doc(db, "architectures", architectureA), {
        headCommitId: "forged",
      }),
    );

    await assertFails(
      setDoc(
        doc(db, "architectures", architectureA, "commits", "commit-b"),
        {
          ...commitData,
          ownerId: userB.uid,
          createdBy: userB.uid,
          createdAt: new Date(),
        },
      ),
    );
  });

  test("a second commit must use the current Main head as its parent", async () => {
    await seedCommitArchitecture();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "commits", "commit-a"),
        {
          ...commitData,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
      await updateDoc(doc(context.firestore(), "architectures", architectureA), {
        headCommitId: "commit-a",
      });
    });

    const db = authenticatedDb(userA);
    await assertFails(
      runTransaction(db, async (transaction) => {
        const architectureRef = doc(db, "architectures", architectureA);
        const commitRef = doc(db, "architectures", architectureA, "commits", "commit-b");
        transaction.set(commitRef, {
          ...commitData,
          message: "Forged ancestry",
          parentCommitId: "not-the-head",
          createdAt: serverTimestamp(),
        });
        transaction.update(architectureRef, { headCommitId: "commit-b" });
      }),
    );
  });

  test("a commit cannot reuse a parent from another architecture", async () => {
    await seedCommitArchitecture();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "workspaces", "workspace-b"), {
        ownerId: userA.uid,
        name: "Workspace B",
      });
      await setDoc(doc(context.firestore(), "architectures", "architecture-b"), {
        ownerId: userA.uid,
        workspaceId: "workspace-b",
        name: "Architecture B",
        nodes: [],
        edges: [],
      });
      await setDoc(
        doc(context.firestore(), "architectures", "architecture-b", "commits", "foreign"),
        {
          ...commitData,
          architectureId: "architecture-b",
          workspaceId: "workspace-b",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
    });

    const db = authenticatedDb(userA);
    await assertFails(
      runTransaction(db, async (transaction) => {
        const architectureRef = doc(db, "architectures", architectureA);
        const commitRef = doc(db, "architectures", architectureA, "commits", "commit-b");
        transaction.set(commitRef, {
          ...commitData,
          message: "Foreign parent",
          parentCommitId: "foreign",
          createdAt: serverTimestamp(),
        });
        transaction.update(architectureRef, { headCommitId: "commit-b" });
      }),
    );
  });

  test("commit content remains immutable", async () => {
    await seedCommitArchitecture();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "commits", "commit-a"),
        {
          ...commitData,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
    });

    const db = authenticatedDb(userA);
    await assertFails(
      updateDoc(
        doc(db, "architectures", architectureA, "commits", "commit-a"),
        { message: "Tampered" },
      ),
    );
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


describe("Architecture pull request security rules", () => {
  const branchId = "branch-pr-a";
  const pullRequestId = branchId;

  async function seedPullRequest() {
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
        doc(context.firestore(), "architectures", architectureA, "snapshots", "snapshot-pr"),
        {
          architectureId: architectureA,
          workspaceId: workspaceA,
          ownerId: userA.uid,
          createdBy: userA.uid,
          name: "PR base",
          architectureIR: { schemaVersion: 1, components: [], relations: [] },
          canvasLayout: { nodes: [], edges: [] },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "branches", branchId),
        {
          architectureId: architectureA,
          workspaceId: workspaceA,
          ownerId: userA.uid,
          createdBy: userA.uid,
          name: "feature/pr-review",
          description: "",
          baseSnapshotId: "snapshot-pr",
          status: "active",
          pullRequestId,
          architectureIR: { schemaVersion: 1, components: [], relations: [] },
          canvasLayout: { nodes: [], edges: [] },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
      await setDoc(
        doc(context.firestore(), "architectures", architectureA, "pullRequests", pullRequestId),
        {
          architectureId: architectureA,
          workspaceId: workspaceA,
          ownerId: userA.uid,
          createdBy: userA.uid,
          sourceBranchId: branchId,
          sourceBranchName: "feature/pr-review",
          baseSnapshotId: "snapshot-pr",
          title: "Review architecture change",
          description: "",
          status: "open",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
    });
  }

  test("an open pull request cannot be marked merged while its branch is active", async () => {
    await seedPullRequest();
    await assertFails(
      updateDoc(
        doc(
          authenticatedDb(userA),
          "architectures",
          architectureA,
          "pullRequests",
          pullRequestId,
        ),
        {
          status: "merged",
          updatedAt: serverTimestamp(),
        },
      ),
    );
  });

  test("a pull request can become merged only in the same transaction that merges its branch", async () => {
    await seedPullRequest();
    const db = authenticatedDb(userA);

    await assertSucceeds(
      runTransaction(db, async (transaction) => {
        const branchRef = doc(db, "architectures", architectureA, "branches", branchId);
        const pullRequestRef = doc(
          db,
          "architectures",
          architectureA,
          "pullRequests",
          pullRequestId,
        );

        transaction.update(branchRef, {
          name: "feature/pr-review",
          description: "",
          status: "merged",
          architectureIR: { schemaVersion: 1, components: [], relations: [] },
          canvasLayout: { nodes: [], edges: [] },
        });
        transaction.update(pullRequestRef, {
          status: "merged",
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });
});


describe("Project execution task security rules", () => {
  const executionProject = "project-execution-a";
  const archivedProject = "project-execution-archived";
  const executionTask = "task-a";

  const projectData = {
    workspaceId: workspaceA,
    ownerId: userA.uid,
    createdBy: userA.uid,
    name: "Execution Project",
    description: "",
    status: "active",
    sections: {
      planning: "not-started",
      requirements: "not-started",
      roadmap: "not-started",
      design: "not-started",
      architecture: "not-started",
      api: "not-started",
      database: "not-started",
      infrastructure: "not-started",
      code: "not-started",
      testing: "not-started",
      documentation: "not-started",
    },
  };

  const taskData = {
    projectId: executionProject,
    ownerId: userA.uid,
    title: "Implement execution flow",
    description: "Build the first execution workflow.",
    priority: "high",
    status: "todo",
    section: "code",
    sourceId: "code-artifact-a",
    dueDate: "2026-10-20",
  };

  async function seedProject(status: "active" | "archived" = "active") {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "projects", executionProject), {
        ...projectData,
        status,
      });
    });
  }

  test("owner can create and read an execution task on an active project", async () => {
    await seedProject();
    const db = authenticatedDb(userA);
    const taskRef = doc(db, "projects", executionProject, "executionTasks", executionTask);

    await assertSucceeds(setDoc(taskRef, taskData));
    await assertSucceeds(getDoc(taskRef));
  });

  test("unauthenticated and other users cannot read execution tasks", async () => {
    await seedProject();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", executionProject, "executionTasks", executionTask),
        taskData,
      );
    });

    await assertFails(
      getDoc(doc(unauthenticatedDb(), "projects", executionProject, "executionTasks", executionTask)),
    );

    await assertFails(
      getDoc(doc(authenticatedDb(userB), "projects", executionProject, "executionTasks", executionTask)),
    );
  });

  test("other users cannot list execution tasks", async () => {
    await seedProject();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", executionProject, "executionTasks", executionTask),
        taskData,
      );
    });

    await assertFails(
      getDocs(collection(authenticatedDb(userB), "projects", executionProject, "executionTasks")),
    );
  });

  test("execution tasks cannot be created on archived projects", async () => {
    await seedProject("archived");
    await assertFails(
      setDoc(
        doc(authenticatedDb(userA), "projects", executionProject, "executionTasks", executionTask),
        taskData,
      ),
    );
  });

  test("execution task status can be updated without changing immutable fields", async () => {
    await seedProject();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", executionProject, "executionTasks", executionTask),
        taskData,
      );
    });

    const taskRef = doc(authenticatedDb(userA), "projects", executionProject, "executionTasks", executionTask);
    await assertSucceeds(updateDoc(taskRef, { status: "in-progress" }));
  });

  test("execution task identity fields cannot be tampered with during edit", async () => {
    await seedProject();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", executionProject, "executionTasks", executionTask),
        taskData,
      );
    });

    const taskRef = doc(authenticatedDb(userA), "projects", executionProject, "executionTasks", executionTask);
    await assertFails(updateDoc(taskRef, {
      projectId: "forged-project",
      status: "in-progress",
    }));
    await assertFails(updateDoc(taskRef, {
      ownerId: userB.uid,
      status: "in-progress",
    }));
  });

  test("owner can edit mutable execution task fields", async () => {
    await seedProject();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", executionProject, "executionTasks", executionTask),
        taskData,
      );
    });

    const taskRef = doc(authenticatedDb(userA), "projects", executionProject, "executionTasks", executionTask);
    await assertSucceeds(updateDoc(taskRef, {
      title: "Implement execution flow v2",
      description: "Updated workflow.",
      priority: "critical",
      status: "blocked",
      section: "testing",
      sourceId: "test-case-a",
      dueDate: "2026-11-01",
    }));
  });

  test("execution task edits cannot add unexpected fields or mutate ownership", async () => {
    await seedProject();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", executionProject, "executionTasks", executionTask),
        taskData,
      );
    });

    const taskRef = doc(authenticatedDb(userA), "projects", executionProject, "executionTasks", executionTask);
    await assertFails(updateDoc(taskRef, {
      title: "Forged",
      unexpected: true,
    }));
    await assertFails(updateDoc(taskRef, {
      title: "Forged",
      ownerId: userB.uid,
    }));
  });

  test("owner can delete an execution task on an active project but not an archived project", async () => {
    await seedProject();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", executionProject, "executionTasks", executionTask),
        taskData,
      );
    });

    await assertSucceeds(
      deleteDoc(doc(authenticatedDb(userA), "projects", executionProject, "executionTasks", executionTask)),
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "projects", archivedProject), {
        ...projectData,
        status: "archived",
      });
      await setDoc(
        doc(context.firestore(), "projects", archivedProject, "executionTasks", executionTask),
        { ...taskData, projectId: archivedProject },
      );
    });

    await assertFails(
      deleteDoc(doc(authenticatedDb(userA), "projects", archivedProject, "executionTasks", executionTask)),
    );
  });
});
