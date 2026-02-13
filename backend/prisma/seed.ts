import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Units from "Essential Grammar in Use 4th Edition" by Raymond Murphy
 * All 115 units with their topics
 */
const units = [
  { id: 1, title: 'am/is/are', description: 'Present simple of be' },
  { id: 2, title: 'am/is/are (questions)', description: 'Questions with be' },
  { id: 3, title: 'I am doing (present continuous)', description: 'Present continuous tense' },
  { id: 4, title: 'are you doing? (present continuous questions)', description: 'Present continuous questions' },
  { id: 5, title: 'I do/work/like etc. (present simple)', description: 'Present simple tense' },
  { id: 6, title: 'I don\'t... (present simple negative)', description: 'Present simple negative' },
  { id: 7, title: 'Do you...? (present simple questions)', description: 'Present simple questions' },
  { id: 8, title: 'I am doing and I do (present continuous and present simple)', description: 'Comparing present continuous and present simple' },
  { id: 9, title: 'I have... and I\'ve got...', description: 'Have and have got' },
  { id: 10, title: 'was/were', description: 'Past simple of be' },
  { id: 11, title: 'worked/got/went etc. (past simple)', description: 'Past simple tense' },
  { id: 12, title: 'I didn\'t... Did you...? (past simple negative and questions)', description: 'Past simple negative and questions' },
  { id: 13, title: 'I was doing (past continuous)', description: 'Past continuous tense' },
  { id: 14, title: 'I was doing and I did (past continuous and past simple)', description: 'Comparing past continuous and past simple' },
  { id: 15, title: 'I have done (present perfect 1)', description: 'Present perfect introduction' },
  { id: 16, title: 'I\'ve just... I\'ve already... I haven\'t...yet (present perfect 2)', description: 'Present perfect with just, already, yet' },
  { id: 17, title: 'Have you ever...? (present perfect 3)', description: 'Present perfect questions with ever' },
  { id: 18, title: 'How long have you...? (present perfect 4)', description: 'Present perfect duration' },
  { id: 19, title: 'for since ago', description: 'Time expressions' },
  { id: 20, title: 'I have done and I did (present perfect and past simple 1)', description: 'Comparing present perfect and past simple' },
  { id: 21, title: 'is done was done (passive 1)', description: 'Passive voice introduction' },
  { id: 22, title: 'is being done has been done (passive 2)', description: 'Passive continuous and perfect' },
  { id: 23, title: 'be/have/do in present and past tenses', description: 'Auxiliary verbs' },
  { id: 24, title: 'Regular and irregular verbs', description: 'Verb forms' },
  { id: 25, title: 'What are you doing tomorrow?', description: 'Present continuous for future' },
  { id: 26, title: 'I\'m going to...', description: 'Going to for future' },
  { id: 27, title: 'will 1', description: 'Will for predictions' },
  { id: 28, title: 'will 2', description: 'Will for decisions and offers' },
  { id: 29, title: 'might', description: 'Might for possibility' },
  { id: 30, title: 'can and could', description: 'Ability and permission' },
  { id: 31, title: 'must mustn\'t needn\'t', description: 'Obligation and necessity' },
  { id: 32, title: 'should', description: 'Advice and recommendation' },
  { id: 33, title: 'I have to...', description: 'Have to for obligation' },
  { id: 34, title: 'Would you like...? I\'d like...', description: 'Polite requests and offers' },
  { id: 35, title: 'there is there are', description: 'There is/are' },
  { id: 36, title: 'there was/were there has/have been there will be', description: 'There in different tenses' },
  { id: 37, title: 'It...', description: 'It for time, weather, distance' },
  { id: 38, title: 'I am, I don\'t etc.', description: 'Short answers' },
  { id: 39, title: 'Have you? Are you? Don\'t you? etc.', description: 'Question tags' },
  { id: 40, title: 'too/either so am I / neither do I etc.', description: 'Agreement' },
  { id: 41, title: 'isn\'t haven\'t don\'t etc. (negatives)', description: 'Negative forms' },
  { id: 42, title: 'is it...? have you...? do they...? etc. (questions 1)', description: 'Yes/no questions' },
  { id: 43, title: 'Who saw you? Who did you see?', description: 'Subject and object questions' },
  { id: 44, title: 'Who is she talking to? What is it like?', description: 'Questions ending with prepositions' },
  { id: 45, title: 'What...? Which...? How...?', description: 'Question words' },
  { id: 46, title: 'How long does it take...?', description: 'Duration questions' },
  { id: 47, title: 'Do you know where...? I don\'t know what... etc.', description: 'Indirect questions' },
  { id: 48, title: 'She said that... He told me that...', description: 'Reported speech' },
  { id: 49, title: 'work/working go/going do/doing', description: '-ing and infinitive' },
  { id: 50, title: 'to... (I want to do) and -ing (I enjoy doing)', description: 'Verb patterns' },
  { id: 51, title: 'I want you to... I told you to...', description: 'Verb + object + infinitive' },
  { id: 52, title: 'I went to the shop to...', description: 'Infinitive of purpose' },
  { id: 53, title: 'go to... go on... go for... go -ing', description: 'Go + preposition/gerund' },
  { id: 54, title: 'get', description: 'Uses of get' },
  { id: 55, title: 'do and make', description: 'Do vs make' },
  { id: 56, title: 'have', description: 'Uses of have' },
  { id: 57, title: 'I/me he/him they/them etc.', description: 'Personal pronouns' },
  { id: 58, title: 'my/his/their etc.', description: 'Possessive adjectives' },
  { id: 59, title: 'Whose is this? It\'s mine/yours/hers etc.', description: 'Possessive pronouns' },
  { id: 60, title: 'I/me/my/mine', description: 'Personal pronouns summary' },
  { id: 61, title: 'myself/yourself/themselves etc.', description: 'Reflexive pronouns' },
  { id: 62, title: '-\'s (Kate\'s camera / my brother\'s car) etc.', description: 'Possessive \'s' },
  { id: 63, title: 'a/an...', description: 'Indefinite articles' },
  { id: 64, title: 'train(s) bus(es) (singular and plural)', description: 'Plural forms' },
  { id: 65, title: 'a bottle / some water (countable/uncountable 1)', description: 'Countable and uncountable nouns' },
  { id: 66, title: 'a cake / some cake / some cakes (countable/uncountable 2)', description: 'More countable/uncountable' },
  { id: 67, title: 'a/an and the', description: 'Articles' },
  { id: 68, title: 'the...', description: 'Definite article' },
  { id: 69, title: '(a) flower(s) (the) flower(s) (singular and plural)', description: 'Articles with plurals' },
  { id: 70, title: 'the... (names of places)', description: 'The with place names' },
  { id: 71, title: 'this/that/these/those', description: 'Demonstratives' },
  { id: 72, title: 'one/ones', description: 'One and ones' },
  { id: 73, title: 'some and any', description: 'Some vs any' },
  { id: 74, title: 'not + any no none', description: 'Negatives with any/no' },
  { id: 75, title: 'not + anybody/anyone/anything nobody/no-one/nothing', description: 'Negative indefinites' },
  { id: 76, title: 'somebody/anything/nowhere etc.', description: 'Indefinite pronouns' },
  { id: 77, title: 'every and all', description: 'Every vs all' },
  { id: 78, title: 'all most some any no/none', description: 'Quantifiers' },
  { id: 79, title: 'both either neither', description: 'Both, either, neither' },
  { id: 80, title: 'a lot much many', description: 'Quantifiers for large quantities' },
  { id: 81, title: '(a) little (a) few', description: 'Quantifiers for small quantities' },
  { id: 82, title: 'old/nice/interesting etc. (adjectives)', description: 'Adjectives' },
  { id: 83, title: 'quickly/badly/suddenly etc. (adverbs)', description: 'Adverbs' },
  { id: 84, title: 'old/older expensive/more expensive', description: 'Comparatives' },
  { id: 85, title: 'older than... more expensive than...', description: 'Comparative structures' },
  { id: 86, title: 'not as... as', description: 'Comparisons with as...as' },
  { id: 87, title: 'the oldest the most expensive', description: 'Superlatives' },
  { id: 88, title: 'enough', description: 'Enough' },
  { id: 89, title: 'too', description: 'Too' },
  { id: 90, title: 'Word order 1 - verb + object; place and time', description: 'Word order basics' },
  { id: 91, title: 'Word order 2 - adverbs with the verb', description: 'Adverb placement' },
  { id: 92, title: 'still yet already', description: 'Time adverbs' },
  { id: 93, title: 'Give me that book! Give it to me!', description: 'Verbs with two objects' },
  { id: 94, title: 'and but or so because', description: 'Conjunctions' },
  { id: 95, title: 'When...', description: 'When clauses' },
  { id: 96, title: 'If we go... If you see... etc.', description: 'First conditional' },
  { id: 97, title: 'If I had... If we went... etc.', description: 'Second conditional' },
  { id: 98, title: 'a person who... a thing that/which... (relative clauses 1)', description: 'Relative clauses with who/that/which' },
  { id: 99, title: 'the people we met the hotel you stayed at (relative clauses 2)', description: 'Relative clauses without who/that/which' },
  { id: 100, title: 'at 8 o\'clock on Monday in April', description: 'Prepositions of time' },
  { id: 101, title: 'from... to until since for', description: 'Time prepositions' },
  { id: 102, title: 'before after during while', description: 'More time prepositions' },
  { id: 103, title: 'in at on (places 1)', description: 'Prepositions of place 1' },
  { id: 104, title: 'in at on (places 2)', description: 'Prepositions of place 2' },
  { id: 105, title: 'to in at (places 3)', description: 'Prepositions of place 3' },
  { id: 106, title: 'under behind opposite etc.', description: 'Position prepositions' },
  { id: 107, title: 'up over through etc.', description: 'Movement prepositions' },
  { id: 108, title: 'on at by with about', description: 'Common prepositions' },
  { id: 109, title: 'afraid of..., good at... etc. of/at/for etc. (prepositions) + -ing', description: 'Adjective + preposition' },
  { id: 110, title: 'listen to..., look at... etc. (verb + preposition)', description: 'Verb + preposition' },
  { id: 111, title: 'go in, fall off, run away etc. (phrasal verbs 1)', description: 'Phrasal verbs 1' },
  { id: 112, title: 'put on your shoes put your shoes on (phrasal verbs 2)', description: 'Phrasal verbs 2' },
  { id: 113, title: 'go on   carry on   take off etc. (phrasal verbs 3)', description: 'Phrasal verbs 3' },
  { id: 114, title: 'on holiday by car in time', description: 'Common expressions' },
  { id: 115, title: 'Appendix 1-6', description: 'Irregular verbs, spelling, short forms, etc.' },
];

async function main() {
  console.log('🌱 Seeding database with Murphy\'s Grammar Units...\n');

  try {
    // Delete existing units (if any)
    await prisma.unit.deleteMany({});
    console.log('✅ Cleared existing units\n');

    // Insert all 115 units
    for (const unit of units) {
      await prisma.unit.create({
        data: unit,
      });
      console.log(`✅ Created Unit ${unit.id}: ${unit.title}`);
    }

    console.log(`\n✅ Successfully seeded ${units.length} units!\n`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
