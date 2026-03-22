import client from "./client";
import type { Project } from "../types/api";

export async function listProjects(): Promise<Project[]> {
  const { data } = await client.get("/projects");
  return data;
}

export async function createProject(body: {
  name: string;
  description?: string;
  location?: string;
}): Promise<Project> {
  const { data } = await client.post("/projects", body);
  return data;
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await client.get(`/projects/${id}`);
  return data;
}

export async function updateProject(
  id: number,
  body: { name?: string; description?: string; location?: string }
): Promise<Project> {
  const { data } = await client.put(`/projects/${id}`, body);
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await client.delete(`/projects/${id}`);
}
