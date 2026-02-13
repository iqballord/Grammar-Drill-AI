import { connectDatabase, disconnectDatabase, checkDatabaseHealth, prisma } from './db/client';
import { generateQuestion } from './ai/generator';

/**
 * Test script to verify:
 * 1. Database connection
 * 2. Gemini AI generation
 * 3. Basic CRUD operations
 */
async function testSetup() {
  console.log('\n🧪 Testing Setup...\n');

  try {
    // Test 1: Database Connection
    console.log('1️⃣ Testing database connection...');
    await connectDatabase();
    const isHealthy = await checkDatabaseHealth();
    if (isHealthy) {
      console.log('   ✅ Database connection successful!\n');
    } else {
      throw new Error('Database health check failed');
    }

    // Test 2: Gemini AI Question Generation
    console.log('2️⃣ Testing Gemini AI question generation...');
    console.log('   Generating question for Unit 5 (Present Simple)...\n');

    const question = await generateQuestion(5);

    console.log('   ✅ AI generation successful!');
    console.log('   📝 Generated Question:');
    console.log(`   Type: ${question.type}`);
    console.log(`   Question: ${question.question}`);
    console.log(`   Options: ${question.options ? JSON.stringify(question.options) : 'null'}`);
    console.log(`   Answer: ${question.correct_answer}`);
    console.log(`   Explanation: ${question.explanation}\n`);

    // Test 3: Database Operations
    console.log('3️⃣ Testing database operations...');

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        telegramId: BigInt(123456789),
        username: 'test_user',
      },
    });
    console.log(`   ✅ Created test user: ${testUser.username} (ID: ${testUser.id})`);

    // Create a unit entry
    const unit = await prisma.unit.create({
      data: {
        id: 5,
        title: 'Present Simple (he/she/it)',
        description: 'Third person singular in present simple tense',
        murphyPage: 10,
      },
    });
    console.log(`   ✅ Created unit: ${unit.title}`);

    // Save the generated question
    const savedQuestion = await prisma.question.create({
      data: {
        unitId: question.unit,
        type: question.type,
        question: question.question,
        options: question.options,
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
      },
    });
    console.log(`   ✅ Saved question to database (ID: ${savedQuestion.id})`);

    // Create a quiz attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: testUser.id,
        questionId: savedQuestion.id,
        unitId: unit.id,
        userAnswer: question.correct_answer,
        isCorrect: true,
      },
    });
    console.log(`   ✅ Created quiz attempt (ID: ${attempt.id})\n`);

    // Test 4: Query Data
    console.log('4️⃣ Testing data queries...');

    const userWithAttempts = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: {
        quizAttempts: {
          include: {
            question: true,
            unit: true,
          },
        },
      },
    });

    console.log(`   ✅ Retrieved user with ${userWithAttempts?.quizAttempts.length} quiz attempts`);

    const accuracy = userWithAttempts?.quizAttempts.filter(a => a.isCorrect).length || 0;
    const total = userWithAttempts?.quizAttempts.length || 0;
    console.log(`   📊 Accuracy: ${accuracy}/${total} (${total > 0 ? (accuracy/total * 100).toFixed(0) : 0}%)\n`);

    // Cleanup: Delete test data
    console.log('5️⃣ Cleaning up test data...');
    await prisma.quizAttempt.deleteMany({ where: { userId: testUser.id } });
    await prisma.question.deleteMany({ where: { id: savedQuestion.id } });
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
    console.log('   ✅ Test data cleaned up\n');

    console.log('✅ All tests passed! Your setup is ready.\n');
    console.log('🚀 You can now start building the Telegram bot!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

// Run the test
testSetup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
