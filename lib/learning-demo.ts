import type { PrismaClient } from "./generated/prisma/client.ts";

export async function createLearningDemo(db: PrismaClient, adminId: string) {
  return db.$transaction(async (tx) => {
    const added = await tx.learningDemoProfile.createMany({
      data: { adminId },
      skipDuplicates: true,
    });
    if (!added.count) return false;

    await tx.learningTask.createMany({
      data: [
        { body: "Бір апталық шығындарды санаттарға бөліп жазу", completed: true },
        { body: "Келесі айға жеке бюджет құру", completed: false },
        { body: "Жинақ мақсатын және ай сайынғы жарнаны есептеу", completed: false },
      ].map((task) => ({ ...task, adminId })),
    });
    await tx.adminEvent.create({
      data: { actor: adminId, student: "", action: "learning.demo.create", reference: adminId },
    });
    return true;
  });
}
