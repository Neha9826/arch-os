import { describe, expect, test } from "vitest";
import {
  canOpenPullRequestFromBranch,
  canTransitionPullRequestStatus,
} from "@/domain/architecture/pullRequests";

describe("Architecture pull request foundation", () => {
  test("only active branches can open a pull request", () => {
    expect(canOpenPullRequestFromBranch("active")).toBe(true);
    expect(canOpenPullRequestFromBranch("merged")).toBe(false);
    expect(canOpenPullRequestFromBranch("abandoned")).toBe(false);
  });

  test("a closed pull request can be reopened from an active branch", () => {
    expect(canOpenPullRequestFromBranch("active", "closed")).toBe(true);
    expect(canOpenPullRequestFromBranch("active", "open")).toBe(false);
    expect(canOpenPullRequestFromBranch("active", "merged")).toBe(false);
  });

  test("open pull requests support close or merge transitions", () => {
    expect(canTransitionPullRequestStatus("open", "closed")).toBe(true);
    expect(canTransitionPullRequestStatus("open", "merged")).toBe(true);
    expect(canTransitionPullRequestStatus("open", "open")).toBe(true);
  });

  test("closed and merged pull requests are terminal", () => {
    expect(canTransitionPullRequestStatus("closed", "open")).toBe(false);
    expect(canTransitionPullRequestStatus("closed", "merged")).toBe(false);
    expect(canTransitionPullRequestStatus("merged", "closed")).toBe(false);
    expect(canTransitionPullRequestStatus("merged", "open")).toBe(false);
  });
});
