BRANCH=$(printenv BRANCH)
STATE=$(printenv STATE)
TARGET=$(printenv TARGET)
VERCEL_TEAM_ID=$(printenv VERCEL_TEAM_ID)
VERCEL_TOKEN=$(printenv VERCEL_TOKEN)
VERCEL_PROJECT=$(printenv VERCEL_PROJECT)

IFS=$' \t\r\n'

if [[ $TARGET == "production"  ]]; then
  deployments=$(
    curl \
    -X GET \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -s \
    "https://api.vercel.com/v6/deployments?teamId=$VERCEL_TEAM_ID&projectId=$VERCEL_PROJECT&limit=100&target=$TARGET"
  )

  deployments_length=$(echo $deployments | jq -c '.deployments | map(.uid) | length')

  before=$(date -d '30 days ago' +%s000)

  matching_deployments=$(
    curl \
    -X GET \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -s \
    "https://api.vercel.com/v6/deployments?teamId=$VERCEL_TEAM_ID&projectId=$VERCEL_PROJECT&limit=100&target=$TARGET&until=$before"
  )

  matching=$(
    echo $matching_deployments | jq -c '.deployments | map(.uid)'
  )
  matching_length=$(echo $matching | jq '. | length')

  # Checking here to see if all deployments matches deployments over 30 days.
  # If this is true, it means all deployments are over 30 days.
  # In this case, we should cancel the clean as it would also clean the current deployment.
  if [[ $matching_length == $deployments_length ]]; then
    exit
  fi

elif [[ $BRANCH && $TARGET == "preview" ]]; then
  deployments=$(
    curl \
    -X GET \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -s \
    "https://api.vercel.com/v6/deployments?teamId=$VERCEL_TEAM_ID&projectId=$VERCEL_PROJECT&limit=100&target=$TARGET&state=$STATE"
  )

  matching=$(
    echo $deployments | jq -c '.deployments | map(select(.meta.githubCommitRef == "'"$BRANCH"'") | .uid)'
  )

fi

for uid in $(echo "${matching}" | jq -r .[] | xargs);
do 
  echo "Removing deployment..."
  echo $uid

  curl \
  -X DELETE \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -s \
  "https://api.vercel.com/v13/deployments/$uid?teamId=$VERCEL_TEAM_ID"

  sleep 2
  echo $'\n'
done

echo Finished cleaning stale deployments.
