import { PrismaClient } from "@prisma/client";
import { computeOverallScoreFromCategories } from "../lib/progress-assessment-category-scores";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Starting DRY RUN for overallScore backfill...\n");

  const assessments = await prisma.progressAssessment.findMany({
    select: {
      id: true,
      overallScore: true,
      strengthScore: true,
      flexibilityScore: true,
      techniqueScore: true,
      disciplineScore: true,
    },
  });

  let total = assessments.length;
  let eligible = 0;
  let wouldUpdate = 0;

  const samples: any[] = [];

  for (const a of assessments) {
    const {
      strengthScore,
      flexibilityScore,
      techniqueScore,
      disciplineScore,
    } = a;

    // Only process rows with all 4 categories
    if (
      strengthScore != null &&
      flexibilityScore != null &&
      techniqueScore != null &&
      disciplineScore != null
    ) {
      eligible++;

      const computed = computeOverallScoreFromCategories(
        strengthScore,
        flexibilityScore,
        techniqueScore,
        disciplineScore,
      );

      if (a.overallScore !== computed) {
        wouldUpdate++;

        // Collect sample rows (max 10)
        if (samples.length < 10) {
          samples.push({
            id: a.id,
            old: a.overallScore,
            new: computed,
            categories: {
              strengthScore,
              flexibilityScore,
              techniqueScore,
              disciplineScore,
            },
          });
        }
      }
    }
  }

  console.log("📊 DRY RUN SUMMARY:");
  console.log("----------------------------");
  console.log("Total rows:", total);
  console.log("Eligible rows (all 4 scores present):", eligible);
  console.log("Would update:", wouldUpdate);

  console.log("\n🧪 Sample changes (max 10):");
  console.log("----------------------------");
  samples.forEach((s, i) => {
    console.log(`${i + 1}. ID: ${s.id}`);
    console.log(`   Old: ${s.old} → New: ${s.new}`);
    console.log(`   Categories:`, s.categories);
    console.log("");
  });

  console.log("✅ Dry run complete. No data was changed.\n");
}

main()
  .catch((e) => {
    console.error("❌ Error during dry run:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });