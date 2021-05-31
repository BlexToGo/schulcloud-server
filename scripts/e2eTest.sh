#! /bin/bash

set -e

# Preconditions
sudo rm /usr/local/bin/docker-compose
curl -L https://github.com/docker/compose/releases/download/1.27.4/docker-compose-`uname -s`-`uname -m` > docker-compose
chmod +x docker-compose
sudo mv docker-compose /usr/local/bin

# Envirements
export BRANCH_NAME=${TRAVIS_PULL_REQUEST_BRANCH:=$TRAVIS_BRANCH}

echo "BRANCH: $BRANCH_NAME"

urlBranch="https://raw.githubusercontent.com/hpi-schul-cloud/end-to-end-tests/$BRANCH_NAME/scripts/ci/end-to-end-tests.travis.sh"
urlDevelop="https://raw.githubusercontent.com/hpi-schul-cloud/end-to-end-tests/develop/scripts/ci/end-to-end-tests.travis.sh"
urlMaster="https://raw.githubusercontent.com/hpi-schul-cloud/end-to-end-tests/master/scripts/ci/end-to-end-tests.travis.sh"

status=$(curl --head --silent $urlBranch | head -n 1)

# Execute
if echo "$status" | grep -q 404
  echo "Matching branchname found in end-to-ent-test repo"
  curl -fO $urlBranch
else
  echo "Fallback to default branch in end-to-ent-test repo"
  if [$BRANCH_NAME = feature*]
  then
    curl -fO $urlDevelop
  else
    curl -fO $urlMaster
  fi
fi

echo "$MY_DOCKER_PASSWORD" | docker login -u "$DOCKER_ID" --password-stdin

ls -a
chmod 700 end-to-end-tests.travis.sh
bash end-to-end-tests.travis.sh

set +e
