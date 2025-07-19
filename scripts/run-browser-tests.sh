#!/bin/bash

# Script to run browser compatibility tests across different browsers
# Usage: ./scripts/run-browser-tests.sh [chrome|firefox|safari|all]

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests and report results
run_test() {
  local browser=$1
  local test_command=$2
  
  echo -e "${YELLOW}Running tests for $browser...${NC}"
  
  if $test_command; then
    echo -e "${GREEN}✓ Tests passed for $browser${NC}"
    return 0
  else
    echo -e "${RED}✗ Tests failed for $browser${NC}"
    return 1
  fi
}

# Check if Playwright browsers are installed
if ! npx playwright --version &> /dev/null; then
  echo -e "${YELLOW}Installing Playwright browsers...${NC}"
  npx playwright install
fi

# Parse command line arguments
browser=${1:-all}

case $browser in
  chrome)
    run_test "Chrome" "npx playwright test --project=chromium"
    ;;
  firefox)
    run_test "Firefox" "npx playwright test --project=firefox"
    ;;
  safari)
    run_test "Safari" "npx playwright test --project=webkit"
    ;;
  mobile)
    run_test "Mobile Chrome" "npx playwright test --project=\"Mobile Chrome\""
    run_test "Mobile Safari" "npx playwright test --project=\"Mobile Safari\""
    ;;
  accessibility)
    run_test "Accessibility" "npx playwright test accessibility.test.ts"
    ;;
  compatibility)
    run_test "Browser Compatibility" "npx playwright test browser-compatibility.test.ts"
    ;;
  all)
    echo -e "${YELLOW}Running tests across all browsers...${NC}"
    
    # Run tests for each browser
    chrome_result=0
    firefox_result=0
    safari_result=0
    mobile_chrome_result=0
    mobile_safari_result=0
    
    run_test "Chrome" "npx playwright test --project=chromium" || chrome_result=1
    run_test "Firefox" "npx playwright test --project=firefox" || firefox_result=1
    run_test "Safari" "npx playwright test --project=webkit" || safari_result=1
    run_test "Mobile Chrome" "npx playwright test --project=\"Mobile Chrome\"" || mobile_chrome_result=1
    run_test "Mobile Safari" "npx playwright test --project=\"Mobile Safari\"" || mobile_safari_result=1
    
    # Print summary
    echo -e "\n${YELLOW}Test Summary:${NC}"
    [ $chrome_result -eq 0 ] && echo -e "${GREEN}✓ Chrome: PASS${NC}" || echo -e "${RED}✗ Chrome: FAIL${NC}"
    [ $firefox_result -eq 0 ] && echo -e "${GREEN}✓ Firefox: PASS${NC}" || echo -e "${RED}✗ Firefox: FAIL${NC}"
    [ $safari_result -eq 0 ] && echo -e "${GREEN}✓ Safari: PASS${NC}" || echo -e "${RED}✗ Safari: FAIL${NC}"
    [ $mobile_chrome_result -eq 0 ] && echo -e "${GREEN}✓ Mobile Chrome: PASS${NC}" || echo -e "${RED}✗ Mobile Chrome: FAIL${NC}"
    [ $mobile_safari_result -eq 0 ] && echo -e "${GREEN}✓ Mobile Safari: PASS${NC}" || echo -e "${RED}✗ Mobile Safari: FAIL${NC}"
    
    # Exit with error if any test failed
    if [ $chrome_result -eq 1 ] || [ $firefox_result -eq 1 ] || [ $safari_result -eq 1 ] || [ $mobile_chrome_result -eq 1 ] || [ $mobile_safari_result -eq 1 ]; then
      exit 1
    fi
    ;;
  *)
    echo -e "${RED}Invalid browser: $browser${NC}"
    echo "Usage: $0 [chrome|firefox|safari|mobile|accessibility|compatibility|all]"
    exit 1
    ;;
esac