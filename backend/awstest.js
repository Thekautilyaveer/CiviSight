// backend/test-s3-write.js
require('dotenv').config();
const aws = require('aws-sdk');

const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
  signatureVersion: 'v4'
});

const BUCKET = process.env.AWS_S3_BUCKET;
const TEST_KEY = 'test/write-test-' + Date.now() + '.txt';
const TEST_CONTENT = 'This is a test file to verify S3 write permissions';

async function testS3Write() {
  console.log('Testing S3 write permissions...\n');
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`Test file: ${TEST_KEY}\n`);

  try {
    // Test 1: Upload (PutObject)
    console.log('1. Testing PUT (upload)...');
    await s3.putObject({
      Bucket: BUCKET,
      Key: TEST_KEY,
      Body: TEST_CONTENT,
      ContentType: 'text/plain'
    }).promise();
    console.log('   ✅ PUT successful - File uploaded!\n');

    // Test 2: Read (GetObject)
    console.log('2. Testing GET (read)...');
    const result = await s3.getObject({
      Bucket: BUCKET,
      Key: TEST_KEY
    }).promise();
    const content = result.Body.toString();
    console.log('   ✅ GET successful - File retrieved!');
    console.log(`   Content: "${content}"\n`);

    // Test 3: List objects in bucket
    console.log('3. Testing ListBucket...');
    const listResult = await s3.listObjectsV2({
      Bucket: BUCKET,
      Prefix: 'test/',
      MaxKeys: 5
    }).promise();
    console.log('   ✅ ListBucket successful!');
    console.log(`   Found ${listResult.Contents.length} object(s) with prefix "test/"\n`);

    // Test 4: Delete (cleanup)
    console.log('4. Testing DELETE (cleanup)...');
    await s3.deleteObject({
      Bucket: BUCKET,
      Key: TEST_KEY
    }).promise();
    console.log('   ✅ DELETE successful - Test file removed!\n');

    console.log('🎉 All tests passed! Your S3 credentials have full access to the bucket.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'AccessDenied') {
      console.error('\n⚠️  Permission Issue:');
      console.error('Your IAM user needs these permissions:');
      console.error('  - s3:PutObject (to upload)');
      console.error('  - s3:GetObject (to read)');
      console.error('  - s3:DeleteObject (to delete)');
      console.error('  - s3:ListBucket (to list objects)');
    } else if (error.code === 'NoSuchBucket') {
      console.error('\n⚠️  Bucket does not exist or wrong bucket name');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.error('\n⚠️  Signature Error:');
      console.error('  - Check your AWS_ACCESS_KEY_ID');
      console.error('  - Check your AWS_SECRET_ACCESS_KEY');
      console.error('  - Verify AWS_REGION matches your bucket region');
    }
    
    process.exit(1);
  }
}

testS3Write();