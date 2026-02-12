# 🎯 Move 1: Verify Test Infrastructure - EXTREME DETAIL PLAN

**Estimated Time**: 30 minutes  
**Priority**: CRITICAL - Must complete before any other testing  
**Status**: IN PROGRESS

---

## 📋 **OBJECTIVE**

Verify that the entire test infrastructure is working correctly:
- All test files can execute
- All mocks and helpers function properly
- CI/CD workflow is valid and will run tests correctly
- No blocking issues that prevent testing

**Success Criteria**:
- ✅ All backend tests run without errors
- ✅ All frontend tests run without errors
- ✅ All mocks work correctly
- ✅ All helpers function properly
- ✅ CI/CD workflow validates successfully
- ✅ No import/module errors
- ✅ No configuration errors

---

## 🔍 **STEP-BY-STEP EXECUTION PLAN**

### **PHASE 1: Backend Test Infrastructure Verification (10 minutes)**

#### **Step 1.1: Verify Test Configuration**
**Time**: 2 minutes

**Actions**:
1. Check `jest.config.js` exists and is valid
2. Verify test environment setup
3. Verify test file patterns are correct

**Commands**:
```bash
# Navigate to backend
cd c:\Users\onlyw\Documents\GitHub\puretask-backend

# Check Jest config exists
Test-Path jest.config.js

# Validate Jest config syntax
node -e "require('./jest.config.js')"

# Check for coverage config
Test-Path jest.config.coverage.js
```

**Expected Output**:
- ✅ `jest.config.js` exists
- ✅ Config loads without errors
- ✅ `jest.config.coverage.js` exists (if applicable)

**If Errors**:
- Fix syntax errors in config files
- Ensure all required dependencies are installed
- Check Node.js version compatibility

---

#### **Step 1.2: Verify Test Dependencies**
**Time**: 2 minutes

**Actions**:
1. Check all test dependencies are installed
2. Verify versions are compatible
3. Check for missing packages

**Commands**:
```bash
# Check if node_modules exists
Test-Path node_modules

# Verify test dependencies
npm list jest
npm list ts-jest
npm list @types/jest
npm list supertest
npm list @faker-js/faker

# Check for any missing dependencies
npm install
```

**Expected Output**:
- ✅ All test dependencies installed
- ✅ No missing packages
- ✅ No version conflicts

**If Errors**:
- Run `npm install` to install missing packages
- Check `package.json` for correct dependency versions
- Resolve any version conflicts

---

#### **Step 1.3: Verify Test Setup Files**
**Time**: 2 minutes

**Actions**:
1. Check test setup file exists
2. Verify environment variables for testing
3. Check database connection setup for tests

**Commands**:
```bash
# Check test setup file
Test-Path src/tests/setup.ts

# Verify setup file syntax
npx tsc --noEmit src/tests/setup.ts

# Check for test environment variables
Get-Content .env.test -ErrorAction SilentlyContinue
```

**Expected Output**:
- ✅ `src/tests/setup.ts` exists and is valid
- ✅ Test environment variables configured (or using defaults)
- ✅ No TypeScript errors

**If Errors**:
- Create `src/tests/setup.ts` if missing
- Add test environment variables to `.env.test`
- Ensure test database connection is configured

---

#### **Step 1.4: Discover All Test Files**
**Time**: 2 minutes

**Actions**:
1. Find all test files in backend
2. Count test files
3. Verify test file naming convention

**Commands**:
```bash
# Find all test files
Get-ChildItem -Path src -Filter "*.test.ts" -Recurse | Select-Object FullName

# Count test files
$testFiles = Get-ChildItem -Path src -Filter "*.test.ts" -Recurse
Write-Host "Total test files: $($testFiles.Count)"

# List test files by directory
Get-ChildItem -Path src -Filter "*.test.ts" -Recurse | Group-Object Directory | Select-Object Name, Count

# Also check for .spec.ts files
Get-ChildItem -Path src -Filter "*.spec.ts" -Recurse | Select-Object FullName
```

**Expected Output**:
- ✅ Test files found (should be 20+ files based on our implementation)
- ✅ Test files follow naming convention (`*.test.ts` or `*.spec.ts`)
- ✅ Test files organized in appropriate directories

**If Errors**:
- Verify test files are in correct locations
- Check file naming matches Jest configuration
- Ensure test files are not excluded by `.gitignore`

---

#### **Step 1.5: Run Backend Tests (Dry Run)**
**Time**: 2 minutes

**Actions**:
1. Run Jest with `--listTests` to verify test discovery
2. Check for import/module errors
3. Verify no configuration issues

**Commands**:
```bash
# List all tests Jest will run (without executing)
npm run test -- --listTests

# Try to load test files (check for import errors)
npm run test -- --findRelatedTests src/lib/__tests__/tiers.test.ts --passWithNoTests

# Check for TypeScript compilation errors
npm run typecheck
```

**Expected Output**:
- ✅ Jest discovers all test files
- ✅ No import/module errors
- ✅ TypeScript compiles without errors
- ✅ Test files can be loaded

**If Errors**:
- Fix import errors (check paths, missing dependencies)
- Fix TypeScript errors
- Ensure all dependencies are installed
- Check module resolution in `tsconfig.json`

---

### **PHASE 2: Frontend Test Infrastructure Verification (10 minutes)**

#### **Step 2.1: Navigate to Frontend**
**Time**: 1 minute

**Actions**:
1. Navigate to frontend directory
2. Verify frontend test configuration exists

**Commands**:
```bash
# Navigate to frontend
cd ..\puretask-frontend

# Check if directory exists
Test-Path package.json

# Check for Jest/React Testing Library config
Test-Path jest.config.js
Test-Path jest.config.ts
```

**Expected Output**:
- ✅ Frontend directory exists
- ✅ `package.json` exists
- ✅ Test configuration exists

**If Errors**:
- Verify frontend repository path
- Check if frontend is in separate repository
- Ensure frontend is set up

---

#### **Step 2.2: Verify Frontend Test Dependencies**
**Time**: 2 minutes

**Actions**:
1. Check frontend test dependencies
2. Verify React Testing Library installed
3. Check for Playwright (E2E tests)

**Commands**:
```bash
# Check test dependencies
npm list jest
npm list @testing-library/react
npm list @testing-library/jest-dom
npm list @testing-library/user-event
npm list jest-environment-jsdom

# Check for Playwright (E2E)
npm list @playwright/test

# Install if missing
npm install
```

**Expected Output**:
- ✅ All test dependencies installed
- ✅ React Testing Library configured
- ✅ Playwright installed (if E2E tests exist)

**If Errors**:
- Run `npm install` to install missing packages
- Check `package.json` for correct dependencies
- Verify Node.js version compatibility

---

#### **Step 2.3: Discover Frontend Test Files**
**Time**: 2 minutes

**Actions**:
1. Find all frontend test files
2. Count test files
3. Verify test file locations

**Commands**:
```bash
# Find all test files
Get-ChildItem -Path src -Filter "*.test.tsx" -Recurse | Select-Object FullName
Get-ChildItem -Path src -Filter "*.test.ts" -Recurse | Select-Object FullName

# Count test files
$testFiles = Get-ChildItem -Path src -Filter "*.test.*" -Recurse
Write-Host "Total frontend test files: $($testFiles.Count)"

# Check for E2E tests
Get-ChildItem -Path tests -Filter "*.spec.ts" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
```

**Expected Output**:
- ✅ Frontend test files found
- ✅ Test files follow naming convention
- ✅ E2E test files found (if applicable)

**If Errors**:
- Verify test files exist
- Check file naming matches configuration
- Ensure test files are not excluded

---

#### **Step 2.4: Verify Frontend Test Setup**
**Time**: 2 minutes

**Actions**:
1. Check test setup files
2. Verify test environment configuration
3. Check for test utilities

**Commands**:
```bash
# Check for test setup file
Test-Path src/setupTests.ts
Test-Path src/setupTests.js
Test-Path jest.setup.ts

# Check for test utilities
Test-Path src/tests/utils
Test-Path src/__tests__/setup.ts

# Verify TypeScript compilation
npm run typecheck
```

**Expected Output**:
- ✅ Test setup file exists
- ✅ Test utilities available
- ✅ TypeScript compiles without errors

**If Errors**:
- Create test setup file if missing
- Add test utilities if needed
- Fix TypeScript errors

---

#### **Step 2.5: Run Frontend Tests (Dry Run)**
**Time**: 3 minutes

**Actions**:
1. Run Jest with `--listTests` to verify test discovery
2. Check for import/module errors
3. Verify React Testing Library setup

**Commands**:
```bash
# List all tests Jest will run
npm test -- --listTests

# Try to load a test file (check for import errors)
npm test -- --findRelatedTests src/components/Button.test.tsx --passWithNoTests

# Check for configuration issues
npm test -- --showConfig
```

**Expected Output**:
- ✅ Jest discovers all test files
- ✅ No import/module errors
- ✅ React Testing Library configured correctly
- ✅ Test files can be loaded

**If Errors**:
- Fix import errors (check paths, aliases)
- Fix React Testing Library setup
- Check `tsconfig.json` for path mappings
- Verify all dependencies are installed

---

### **PHASE 3: Verify Mocks and Helpers (5 minutes)**

#### **Step 3.1: Verify Backend Mocks**
**Time**: 2 minutes

**Actions**:
1. Check all mock files exist
2. Verify mock implementations
3. Test mock imports

**Commands**:
```bash
# Navigate back to backend
cd ..\puretask-backend

# List all mock files
Get-ChildItem -Path src/tests/mocks -Recurse | Select-Object Name

# Check specific mocks exist
Test-Path src/tests/mocks/stripe.ts
Test-Path src/tests/mocks/sendgrid.ts
Test-Path src/tests/mocks/twilio.ts
Test-Path src/tests/mocks/n8n.ts

# Verify mock files can be imported
node -e "try { require('./src/tests/mocks/stripe.ts'); console.log('Stripe mock OK'); } catch(e) { console.error('Error:', e.message); }"
```

**Expected Output**:
- ✅ All expected mock files exist:
  - `stripe.ts`
  - `sendgrid.ts`
  - `twilio.ts`
  - `n8n.ts`
- ✅ Mock files can be imported
- ✅ No syntax errors in mocks

**If Errors**:
- Create missing mock files
- Fix syntax errors in mocks
- Ensure mocks export correct functions
- Check TypeScript compilation

---

#### **Step 3.2: Verify Backend Helpers**
**Time**: 2 minutes

**Actions**:
1. Check all helper files exist
2. Verify helper functions work
3. Test helper imports

**Commands**:
```bash
# List all helper files
Get-ChildItem -Path src/tests/helpers -Recurse | Select-Object Name

# Check specific helpers exist
Test-Path src/tests/helpers/db.ts
Test-Path src/tests/helpers/seed.ts

# Check for test utilities
Test-Path src/tests/utils/testApp.ts

# Verify helpers can be imported
npx tsc --noEmit src/tests/helpers/db.ts
npx tsc --noEmit src/tests/helpers/seed.ts
```

**Expected Output**:
- ✅ Helper files exist:
  - `db.ts` (database helpers)
  - `seed.ts` (seed data utilities)
- ✅ Helper files compile without errors
- ✅ Helpers can be imported

**If Errors**:
- Create missing helper files
- Fix TypeScript errors
- Ensure helpers export correct functions
- Check database connection setup

---

#### **Step 3.3: Verify Frontend Test Utilities**
**Time**: 1 minute

**Actions**:
1. Check frontend test utilities exist
2. Verify test utilities can be imported

**Commands**:
```bash
# Navigate to frontend
cd ..\puretask-frontend

# Check for test utilities
Get-ChildItem -Path src/tests -Recurse -ErrorAction SilentlyContinue | Select-Object Name
Get-ChildItem -Path src/__tests__ -Recurse -ErrorAction SilentlyContinue | Select-Object Name

# Check for test helpers
Test-Path src/tests/utils
Test-Path src/__tests__/utils
```

**Expected Output**:
- ✅ Test utilities exist (if applicable)
- ✅ Utilities can be imported

**If Errors**:
- Create test utilities if needed
- Fix import errors
- Ensure utilities are properly exported

---

### **PHASE 4: Run Actual Tests and Fix Failures (10 minutes)**

#### **Step 4.1: Run Backend Unit Tests**
**Time**: 3 minutes

**Actions**:
1. Run all backend unit tests
2. Capture failures
3. Document issues

**Commands**:
```bash
# Navigate to backend
cd ..\puretask-backend

# Run unit tests only
npm run test:unit

# If that doesn't exist, run all tests with unit pattern
npm run test -- --testPathPattern=unit

# Capture output to file for review
npm run test -- --testPathPattern=unit > test-results-unit.txt 2>&1
```

**Expected Output**:
- ✅ All unit tests pass
- ✅ No import errors
- ✅ No configuration errors

**If Failures**:
1. **Document each failure**:
   - Test file name
   - Error message
   - Stack trace
2. **Categorize failures**:
   - Import/module errors
   - Mock issues
   - Test logic errors
   - Configuration issues
3. **Fix systematically**:
   - Start with import errors (blocking)
   - Then mock issues
   - Then test logic
   - Finally configuration

---

#### **Step 4.2: Run Backend Integration Tests**
**Time**: 3 minutes

**Actions**:
1. Run all backend integration tests
2. Capture failures
3. Document issues

**Commands**:
```bash
# Run integration tests
npm run test:integration

# If that doesn't exist, run all tests with integration pattern
npm run test -- --testPathPattern=integration

# Capture output
npm run test -- --testPathPattern=integration > test-results-integration.txt 2>&1
```

**Expected Output**:
- ✅ All integration tests pass
- ✅ Database connections work
- ✅ External service mocks work

**If Failures**:
1. **Check database connection**:
   - Verify test database URL
   - Check database is accessible
   - Verify migrations are run
2. **Check mocks**:
   - Verify external service mocks work
   - Check mock implementations
3. **Fix test logic**:
   - Review test assertions
   - Check test data setup
   - Verify cleanup

---

#### **Step 4.3: Run Frontend Tests**
**Time**: 3 minutes

**Actions**:
1. Run all frontend tests
2. Capture failures
3. Document issues

**Commands**:
```bash
# Navigate to frontend
cd ..\puretask-frontend

# Run all tests
npm test

# Run in CI mode (no watch)
npm test -- --ci --watchAll=false

# Capture output
npm test -- --ci --watchAll=false > test-results-frontend.txt 2>&1
```

**Expected Output**:
- ✅ All frontend tests pass
- ✅ React components render correctly
- ✅ No import errors

**If Failures**:
1. **Check React Testing Library setup**:
   - Verify `setupTests.ts` exists
   - Check `@testing-library/jest-dom` imported
   - Verify Jest environment is `jsdom`
2. **Fix component tests**:
   - Check component imports
   - Verify mock implementations
   - Fix test assertions
3. **Fix hook/context tests**:
   - Check context providers
   - Verify hook implementations
   - Fix test setup

---

#### **Step 4.4: Fix All Failures Systematically**
**Time**: 1 minute (documentation, actual fixes may take longer)

**Actions**:
1. Create failure report
2. Prioritize fixes
3. Fix one by one

**Process**:
1. **Create `MOVE_1_FAILURES.md`** with:
   - List of all failures
   - Error messages
   - Suggested fixes
   - Priority (Critical, High, Medium)

2. **Fix in priority order**:
   - Critical: Import errors, configuration issues
   - High: Mock failures, setup issues
   - Medium: Test logic errors

3. **Re-run tests after each fix**:
   ```bash
   # After fixing, re-run specific test
   npm run test -- path/to/test.test.ts
   ```

4. **Document fixes**:
   - Update `MOVE_1_FAILURES.md` with fixes applied
   - Note any patterns or common issues

---

### **PHASE 5: Verify CI/CD Workflow (5 minutes)**

#### **Step 5.1: Check GitHub Actions Workflow**
**Time**: 2 minutes

**Actions**:
1. Verify workflow file exists
2. Check workflow syntax
3. Validate workflow configuration

**Commands**:
```bash
# Navigate to backend
cd ..\puretask-backend

# Check workflow file exists
Test-Path .github/workflows/test.yml

# View workflow file
Get-Content .github/workflows/test.yml

# Check for syntax errors (using yamllint if available, or manual review)
```

**Expected Output**:
- ✅ `.github/workflows/test.yml` exists
- ✅ Workflow file has valid YAML syntax
- ✅ Workflow includes:
  - Backend tests
  - Frontend tests
  - Database service (if needed)
  - Coverage reporting

**If Errors**:
- Fix YAML syntax errors
- Add missing workflow steps
- Verify service configurations
- Check action versions

---

#### **Step 5.2: Validate Workflow Locally (if possible)**
**Time**: 2 minutes

**Actions**:
1. Test workflow steps locally
2. Verify commands work
3. Check environment setup

**Commands**:
```bash
# Test backend workflow steps
npm install
npm run lint
npm run typecheck
npm run test

# Test frontend workflow steps (if in workflow)
cd ..\puretask-frontend
npm install
npm run lint
npm run typecheck
npm test -- --ci
```

**Expected Output**:
- ✅ All workflow commands execute successfully
- ✅ No missing dependencies
- ✅ No configuration errors

**If Errors**:
- Fix command issues
- Add missing scripts to `package.json`
- Fix configuration problems

---

#### **Step 5.3: Verify Workflow Triggers**
**Time**: 1 minute

**Actions**:
1. Check workflow triggers are correct
2. Verify branch protection (if applicable)
3. Check for required status checks

**Review**:
- Workflow should trigger on:
  - Push to main/master
  - Pull requests
  - Manual dispatch (optional)
- Workflow should run:
  - Backend tests
  - Frontend tests
  - Coverage reporting

**Expected Output**:
- ✅ Workflow triggers configured correctly
- ✅ Tests run on appropriate events

**If Errors**:
- Update workflow triggers
- Add missing events
- Configure branch protection rules

---

## 📊 **VERIFICATION CHECKLIST**

Before marking Move 1 complete, verify:

### **Backend**
- [ ] All test files discovered
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All mocks work correctly
- [ ] All helpers function properly
- [ ] No import/module errors
- [ ] TypeScript compiles without errors

### **Frontend**
- [ ] All test files discovered
- [ ] All component tests pass
- [ ] All hook/context tests pass
- [ ] React Testing Library configured
- [ ] No import/module errors
- [ ] TypeScript compiles without errors

### **CI/CD**
- [ ] Workflow file exists and is valid
- [ ] Workflow commands work locally
- [ ] Workflow triggers configured
- [ ] Coverage reporting configured

### **Documentation**
- [ ] Failure report created (if any failures)
- [ ] Fixes documented
- [ ] Common issues noted

---

## 🎯 **SUCCESS CRITERIA**

Move 1 is complete when:

1. ✅ **All tests can run** (no blocking errors)
2. ✅ **All mocks work** (can be imported and used)
3. ✅ **All helpers work** (can be imported and used)
4. ✅ **CI/CD workflow is valid** (syntax correct, commands work)
5. ✅ **No critical failures** (all tests pass or failures are documented and non-blocking)

**Note**: Some test failures are acceptable if they're documented and non-blocking. The goal is to verify the infrastructure works, not to fix all test logic issues (those come in Move 2).

---

## 🚨 **COMMON ISSUES & SOLUTIONS**

### **Issue 1: Import Errors**
**Symptoms**: `Cannot find module` errors  
**Solutions**:
- Check file paths are correct
- Verify `tsconfig.json` paths/aliases
- Ensure dependencies are installed
- Check module resolution

### **Issue 2: Mock Not Working**
**Symptoms**: Tests fail with "mock is not a function"  
**Solutions**:
- Verify mock is exported correctly
- Check mock is imported in test
- Ensure Jest mock setup is correct
- Verify mock implementation matches expected interface

### **Issue 3: Database Connection Errors**
**Symptoms**: Integration tests fail with DB connection errors  
**Solutions**:
- Check test database URL in `.env.test`
- Verify database is accessible
- Ensure migrations are run
- Check connection pooling settings

### **Issue 4: TypeScript Errors**
**Symptoms**: Type errors in test files  
**Solutions**:
- Fix type definitions
- Add missing type imports
- Update `tsconfig.json` if needed
- Check for version mismatches

### **Issue 5: CI/CD Workflow Errors**
**Symptoms**: Workflow fails validation  
**Solutions**:
- Fix YAML syntax errors
- Verify action versions
- Check service configurations
- Ensure all required secrets are set

---

## 📝 **OUTPUT DELIVERABLES**

After completing Move 1, you should have:

1. **Test Execution Report**:
   - List of all tests run
   - Pass/fail status
   - Execution time

2. **Failure Report** (if any failures):
   - `MOVE_1_FAILURES.md` with:
     - List of failures
     - Error messages
     - Fixes applied
     - Remaining issues (if any)

3. **Infrastructure Status**:
   - Backend: ✅ Working / ❌ Issues
   - Frontend: ✅ Working / ❌ Issues
   - Mocks: ✅ Working / ❌ Issues
   - Helpers: ✅ Working / ❌ Issues
   - CI/CD: ✅ Valid / ❌ Issues

4. **Next Steps**:
   - List of issues to fix in Move 2
   - Recommendations for improvements

---

## ⏱️ **TIME TRACKING**

**Estimated Time**: 30 minutes  
**Actual Time**: [TRACK AS YOU GO]

**Breakdown**:
- Phase 1 (Backend): 10 min
- Phase 2 (Frontend): 10 min
- Phase 3 (Mocks/Helpers): 5 min
- Phase 4 (Run Tests): 10 min (may be longer if fixes needed)
- Phase 5 (CI/CD): 5 min

**If taking longer**: Document blockers and continue systematically.

---

## ✅ **COMPLETION CHECKLIST**

Before moving to Move 2, ensure:

- [ ] All phases completed
- [ ] All tests can run (no blocking errors)
- [ ] Mocks verified and working
- [ ] Helpers verified and working
- [ ] CI/CD workflow validated
- [ ] Failure report created (if applicable)
- [ ] Status documented
- [ ] Ready to proceed to Move 2

---

## 🚀 **READY TO START?**

**Begin with Phase 1, Step 1.1** and work through systematically.

**Command to start**:
```bash
cd c:\Users\onlyw\Documents\GitHub\puretask-backend
Test-Path jest.config.js
```

**Let's go!** 🎯
