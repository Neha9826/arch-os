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
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";

let testEnv: RulesTestEnvironment;

const projectId = "demo-arch-os-projects";

const userA = { uid: "user-a", email: "user-a@example.com" };
const userB = { uid: "user-b", email: "user-b@example.com" };

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";
const projectA = "project-a";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(
        path.resolve(process.cwd(), "firestore.rules"),
        "utf8",
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

function db(user: typeof userA) {
  return testEnv.authenticatedContext(user.uid, {
    email: user.email,
  }).firestore();
}

async function seedWorkspace(workspaceId: string, ownerId: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "workspaces", workspaceId), {
      ownerId,
      name: "Workspace",
    });
  });
}

const defaultSections = {
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
};
const projectData = {
  workspaceId: workspaceA,
  ownerId: userA.uid,
  createdBy: userA.uid,
  name: "Commerce Platform",
  description: "Engineering project",
  status: "active",
  sections: defaultSections,
  planning: { objective: "", scope: "", constraints: "", successCriteria: "" },
};

describe("Project security rules", () => {
  test("workspace owner can create a project in their workspace", async () => {
    await seedWorkspace(workspaceA, userA.uid);

    await assertSucceeds(
      setDoc(doc(db(userA), "projects", projectA), projectData),
    );
  });

  test("user cannot create a project in another user's workspace", async () => {
    await seedWorkspace(workspaceB, userB.uid);

    await assertFails(
      setDoc(doc(db(userA), "projects", projectA), {
        ...projectData,
        workspaceId: workspaceB,
      }),
    );
  });

  test("another user cannot read or update a project", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", projectA),
        projectData,
      );
    });

    await assertFails(getDoc(doc(db(userB), "projects", projectA)));
    await assertFails(
      updateDoc(doc(db(userB), "projects", projectA), {
        name: "Forged",
      }),
    );
  });

  test("owner cannot move a project to another workspace or change ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await seedWorkspace(workspaceB, userB.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", projectA),
        projectData,
      );
    });

    await assertFails(
      updateDoc(doc(db(userA), "projects", projectA), {
        workspaceId: workspaceB,
      }),
    );
    await assertFails(
      updateDoc(doc(db(userA), "projects", projectA), {
        ownerId: userB.uid,
      }),
    );
  });

  test("owner can update a valid project section status", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", projectA),
        projectData,
      );
    });

    await assertSucceeds(
      updateDoc(doc(db(userA), "projects", projectA), {
        sections: {
          ...defaultSections,
          architecture: "in-progress",
        },
      }),
    );
  });

  test("owner cannot write an invalid project section map", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", projectA),
        projectData,
      );
    });

    await assertFails(
      updateDoc(doc(db(userA), "projects", projectA), {
        sections: {
          ...defaultSections,
          architecture: "blocked",
        },
      }),
    );
  });

  test("owner cannot change sections on an archived project", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "projects", projectA),
        { ...projectData, status: "archived" },
      );
    });

    await assertFails(
      updateDoc(doc(db(userA), "projects", projectA), {
        sections: {
          ...defaultSections,
          architecture: "complete",
        },
      }),
    );
  });

  test("archived projects and their engineering records cannot be deleted", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(
        doc(firestore, "projects", projectA),
        { ...projectData, status: "archived" },
      );
      await setDoc(
        doc(firestore, "projects", projectA, "requirements", "requirement-a"),
        {
          projectId: projectA,
          ownerId: userA.uid,
          title: "Requirement",
          priority: "medium",
          status: "todo",
        },
      );
    });

    await assertFails(deleteDoc(doc(db(userA), "projects", projectA)));
    await assertFails(
      deleteDoc(
        doc(db(userA), "projects", projectA, "requirements", "requirement-a"),
      ),
    );
  });

  test("owner can edit a requirement without changing its ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(
        doc(firestore, "projects", projectA, "requirements", "requirement-a"),
        {
          projectId: projectA,
          ownerId: userA.uid,
          title: "Original requirement",
          priority: "medium",
          status: "todo",
        },
      );
    });

    await assertSucceeds(
      updateDoc(
        doc(db(userA), "projects", projectA, "requirements", "requirement-a"),
        {
          title: "Updated requirement",
          description: "Clarified acceptance criteria",
          priority: "critical",
          updatedAt: new Date(),
        },
      ),
    );
  });

  test("owner can edit roadmap milestone details without changing ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(doc(firestore, "projects", projectA, "roadmap", "milestone-a"), {
        projectId: projectA,
        ownerId: userA.uid,
        title: "Original milestone",
        description: "Original details",
        targetDate: "2026-11-01",
        status: "planned",
      });
    });

    await assertSucceeds(
      updateDoc(doc(db(userA), "projects", projectA, "roadmap", "milestone-a"), {
        title: "Updated milestone",
        description: "Updated details",
        targetDate: "2026-12-01",
        updatedAt: new Date(),
      }),
    );
    await assertFails(
      updateDoc(doc(db(userA), "projects", projectA, "roadmap", "milestone-a"), {
        ownerId: userB.uid,
        updatedAt: new Date(),
      }),
    );
    await assertFails(
      updateDoc(doc(db(userB), "projects", projectA, "roadmap", "milestone-a"), {
        title: "Unauthorized edit",
        updatedAt: new Date(),
      }),
    );
  });

  test("owner can edit documentation details without changing ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(doc(firestore, "projects", projectA, "documentation", "doc-a"), {
        projectId: projectA, ownerId: userA.uid, title: "API guide", type: "api",
        path: "docs/api.md", summary: "Original summary", status: "planned",
      });
    });
    await assertSucceeds(updateDoc(doc(db(userA), "projects", projectA, "documentation", "doc-a"), {
      title: "API reference", type: "guide", path: "docs/reference.md",
      summary: "Updated summary", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA, "documentation", "doc-a"), {
      ownerId: userB.uid, updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userB), "projects", projectA, "documentation", "doc-a"), {
      title: "Unauthorized", updatedAt: new Date(),
    }));
  });

  test("owner can edit test case details without changing ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(doc(firestore, "projects", projectA, "testCases", "test-a"), {
        projectId: projectA, ownerId: userA.uid, name: "API tests", type: "unit",
        path: "tests/api.test.ts", purpose: "Checks API helpers", status: "planned",
      });
    });
    await assertSucceeds(updateDoc(doc(db(userA), "projects", projectA, "testCases", "test-a"), {
      name: "API integration tests", type: "integration", path: "tests/api.integration.test.ts",
      purpose: "Checks API integration behavior", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA, "testCases", "test-a"), {
      ownerId: userB.uid, updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userB), "projects", projectA, "testCases", "test-a"), {
      name: "Unauthorized", updatedAt: new Date(),
    }));
  });

  test("owner can edit code artifact details without changing ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(doc(firestore, "projects", projectA, "codeArtifacts", "artifact-a"), {
        projectId: projectA, ownerId: userA.uid, name: "API module", language: "TypeScript",
        runtime: "Node.js", path: "src/api", purpose: "Handles API routes", status: "planned",
      });
    });
    await assertSucceeds(updateDoc(doc(db(userA), "projects", projectA, "codeArtifacts", "artifact-a"), {
      name: "API service", language: "TypeScript", runtime: "Next.js", path: "src/services/api",
      purpose: "Owns API integrations", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA, "codeArtifacts", "artifact-a"), {
      ownerId: userB.uid, updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userB), "projects", projectA, "codeArtifacts", "artifact-a"), {
      name: "Unauthorized", updatedAt: new Date(),
    }));
  });

  test("owner can edit infrastructure resource details without changing ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(doc(firestore, "projects", projectA, "infrastructureResources", "resource-a"), {
        projectId: projectA, ownerId: userA.uid, name: "App cluster", provider: "AWS",
        environment: "development", purpose: "Runs app services", status: "planned",
      });
    });
    await assertSucceeds(updateDoc(doc(db(userA), "projects", projectA, "infrastructureResources", "resource-a"), {
      name: "Production cluster", provider: "AWS EKS", environment: "production",
      purpose: "Runs production app services", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA, "infrastructureResources", "resource-a"), {
      ownerId: userB.uid, updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userB), "projects", projectA, "infrastructureResources", "resource-a"), {
      name: "Unauthorized", updatedAt: new Date(),
    }));
  });

  test("owner can edit database entity details without changing ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(doc(firestore, "projects", projectA, "databaseEntities", "entity-a"), {
        projectId: projectA, ownerId: userA.uid, name: "users", purpose: "User records", status: "draft",
      });
    });
    await assertSucceeds(updateDoc(doc(db(userA), "projects", projectA, "databaseEntities", "entity-a"), {
      name: "accounts", purpose: "Account records", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA, "databaseEntities", "entity-a"), {
      name: "invalid-name", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA, "databaseEntities", "entity-a"), {
      ownerId: userB.uid, updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userB), "projects", projectA, "databaseEntities", "entity-a"), {
      name: "stolen", updatedAt: new Date(),
    }));
  });

  test("owner can edit API contract details without changing ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(doc(firestore, "projects", projectA, "apiContracts", "contract-a"), {
        projectId: projectA, ownerId: userA.uid, method: "GET", path: "/api/v1/items",
        title: "List items", description: "Original description", status: "draft",
      });
    });
    await assertSucceeds(updateDoc(doc(db(userA), "projects", projectA, "apiContracts", "contract-a"), {
      method: "POST", path: "/api/v1/items/search", title: "Search items",
      description: "Updated description", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA, "apiContracts", "contract-a"), {
      ownerId: userB.uid, updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userB), "projects", projectA, "apiContracts", "contract-a"), {
      title: "Unauthorized", updatedAt: new Date(),
    }));
  });

  test("owner can edit design decision details without changing ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(doc(firestore, "projects", projectA, "designDecisions", "decision-a"), {
        projectId: projectA, ownerId: userA.uid, title: "Original", decision: "Old decision",
        rationale: "Old rationale", status: "proposed",
      });
    });
    await assertSucceeds(updateDoc(doc(db(userA), "projects", projectA, "designDecisions", "decision-a"), {
      title: "Updated", decision: "New decision", rationale: "New rationale", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA, "designDecisions", "decision-a"), {
      ownerId: userB.uid, updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userB), "projects", projectA, "designDecisions", "decision-a"), {
      title: "Unauthorized", updatedAt: new Date(),
    }));
  });

  test("project owner can delete an engineering record but another user cannot", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(doc(firestore, "projects", projectA, "roadmap", "milestone-a"), {
        projectId: projectA,
        ownerId: userA.uid,
        title: "Milestone",
        status: "planned",
      });
    });

    await assertFails(deleteDoc(doc(db(userB), "projects", projectA, "roadmap", "milestone-a")));
    await assertSucceeds(deleteDoc(doc(db(userA), "projects", projectA, "roadmap", "milestone-a")));
  });

  test("another user cannot edit a requirement", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "projects", projectA), projectData);
      await setDoc(
        doc(firestore, "projects", projectA, "requirements", "requirement-a"),
        {
          projectId: projectA,
          ownerId: userA.uid,
          title: "Original requirement",
          priority: "medium",
          status: "todo",
        },
      );
    });

    await assertFails(
      updateDoc(
        doc(db(userB), "projects", projectA, "requirements", "requirement-a"),
        { title: "Unauthorized edit", updatedAt: new Date() },
      ),
    );
  });

  test("project owner can update project details but cannot change ownership", async () => {
    await seedWorkspace(workspaceA, userA.uid);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "projects", projectA), projectData);
    });
    await assertSucceeds(updateDoc(doc(db(userA), "projects", projectA), {
      name: "Renamed project", description: "Updated project description", updatedAt: new Date(),
    }));
    await assertSucceeds(updateDoc(doc(db(userA), "projects", projectA), {
      description: "", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA), {
      ownerId: userB.uid, updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userB), "projects", projectA), {
      name: "Unauthorized", updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(db(userA), "projects", projectA), {
      description: "x".repeat(1001), updatedAt: new Date(),
    }));
  });

  test("unauthenticated users cannot read or create projects", async () => {
    await seedWorkspace(workspaceA, userA.uid);

    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(unauthenticatedDb, "projects", projectA)));
    await assertFails(
      setDoc(doc(unauthenticatedDb, "projects", projectA), projectData),
    );
  });
});
