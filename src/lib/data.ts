import rubricJson from "../../data/rubric.json";
import employeesJson from "../../data/employees.json";
import extractionsJson from "../../data/extractions.json";
import { z } from "zod/v4";
import { EmployeesFileSchema, ExtractionRecordSchema, RubricSchema, type EmployeeRecord, type Extraction, type Manager, type Rubric } from "./schema";

export type Employee = EmployeeRecord & { manager: Manager; extraction: Extraction; strengthByRun: number[] };

export function loadData(): { rubric: Rubric; managers: Manager[]; employees: Employee[] } {
  const rubric = RubricSchema.parse(rubricJson);
  const { managers, employees } = EmployeesFileSchema.parse(employeesJson);
  const recs = z.array(ExtractionRecordSchema).parse(extractionsJson);
  const joined = employees.map((e) => {
    const rec = recs.find((r) => r.employeeId === e.id);
    if (!rec) throw new Error(`No extraction for ${e.id}`);
    const manager = managers.find((m) => m.id === e.managerId);
    if (!manager) throw new Error(`No manager ${e.managerId}`);
    return { ...e, manager, extraction: rec.extraction, strengthByRun: rec.strengthByRun };
  });
  return { rubric, managers, employees: joined };
}
