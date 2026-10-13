#!/usr/bin/env bash
# Invites a user to GERage. Cognito emails them a temporary password; they pick their own at the first login.
#
# Usage: pnpm user:add <email>
set -euo pipefail

email="${1:-}"
if [[ -z "$email" ]]; then
  echo "Usage: pnpm user:add <email>" >&2
  exit 1
fi

aws_() { aws --profile personal --region eu-central-1 "$@"; }

user_pool_id=$(aws_ cloudformation describe-stacks --stack-name Gerage \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
if [[ -z "$user_pool_id" || "$user_pool_id" == "None" ]]; then
  echo "No user pool found. Is the Gerage stack deployed?" >&2
  exit 1
fi

aws_ cognito-idp admin-create-user \
  --user-pool-id "$user_pool_id" \
  --username "$email" \
  --user-attributes Name=email,Value="$email" Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL \
  --query 'User.UserStatus' --output text > /dev/null

echo "Invited $email. They'll get an email with a temporary password."
