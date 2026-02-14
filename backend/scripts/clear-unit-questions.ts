import { prisma } from '../src/db/client';

/**
 * Clear questions for specific units to allow regeneration
 * Usage: npx tsx scripts/clear-unit-questions.ts [unit1,unit2,...]
 * Example: npx tsx scripts/clear-unit-questions.ts 1,2
 */

async function clearUnitQuestions() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/clear-unit-questions.ts [unit1,unit2,...]');
    console.log('Example: npx tsx scripts/clear-unit-questions.ts 1,2,3');
    console.log('\nOr clear ALL units: npx tsx scripts/clear-unit-questions.ts all');
    process.exit(1);
  }

  try {
    let unitIds: number[];

    if (args[0].toLowerCase() === 'all') {
      console.log('⚠️  WARNING: This will delete ALL questions from database!');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      const allUnits = await prisma.unit.findMany({ select: { id: true } });
      unitIds = allUnits.map(u => u.id);
    } else {
      unitIds = args[0].split(',').map(n => parseInt(n.trim()));
    }

    console.log(`\n🗑️  Clearing questions for units: ${unitIds.join(', ')}\n`);

    for (const unitId of unitIds) {
      // Check if unit exists
      const unit = await prisma.unit.findUnique({ where: { id: unitId } });

      if (!unit) {
        console.log(`❌ Unit ${unitId} not found, skipping...`);
        continue;
      }

      // Count existing questions
      const count = await prisma.question.count({ where: { unitId } });

      if (count === 0) {
        console.log(`ℹ️  Unit ${unitId} (${unit.title}): Already empty`);
        continue;
      }

      // Delete quiz attempts first (foreign key constraint)
      const attemptsDeleted = await prisma.quizAttempt.deleteMany({
        where: { unitId },
      });

      // Delete questions
      const questionsDeleted = await prisma.question.deleteMany({
        where: { unitId },
      });

      console.log(
        `✅ Unit ${unitId} (${unit.title}): Deleted ${questionsDeleted.count} questions, ${attemptsDeleted.count} attempts`
      );
    }

    console.log('\n✨ Done! Questions will be regenerated on next /quiz or /study.\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearUnitQuestions();
