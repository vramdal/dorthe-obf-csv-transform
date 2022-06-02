locals {
  app_identifier = "dorthe-obf-csv-transform"
  deploy_role_name = "deploy-dorthe-obf-csv-transform"
  tags = {
    App = "dorthe-obf-csv-transform"
  }
  website_bucket_name = "dorthe-obf.aws.vidarramdal.com"
  mime_types = jsondecode(file("./mime.json"))
  state_bucket_name = "dorthe-obf-csv-transform"
}


terraform {
  backend "s3" {
    bucket = "dorthe-obf-csv-transform"
    key    = "tf-remote-state"
    region = "eu-central-1"
  }
}
provider "aws" {
  region  = "eu-central-1"

  assume_role {
    # The role ARN within Account B to AssumeRole into. Created in step 1.
    # For å simulere Github Actions, kommenter dette inn
    #role_arn    = "arn:aws:iam:::role/${local.deploy_role_name}"
  }
}

resource aws_iam_role_policy deploy_role_policy {
  role = local.deploy_role_name
  name = "${local.tags.App}-allow-all-access-to-app"
  policy = jsonencode(
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "*"
          ],
          "Resource": ["arn:aws:iam:::role/*", "arn:aws:s3:::*/*"],
          "Condition": {
            "StringEquals": {"aws:ResourceTag/App": local.tags.App}
          }
        },
        {
          "Effect": "Allow",
          "Action": ["iam:GetPolicy", "iam:GetPolicyVersion", "iam:ListEntitiesForPolicy", "iam:GetRolePolicy"],
          "Resource": "*"
        }
      ]
    }
  )
}


resource "aws_s3_bucket" "website-bucket" {
  bucket = local.website_bucket_name
  tags = local.tags
}

resource "aws_s3_bucket_website_configuration" "website-configuration" {

  bucket = aws_s3_bucket.website-bucket.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }

}

resource "aws_s3_bucket_policy" "website-bucket-policy" {
  bucket = aws_s3_bucket.website-bucket.id
  policy = templatefile("templates/s3-policy.json", { bucket = local.website_bucket_name, deploy_role_name = local.deploy_role_name })
}

resource "aws_s3_bucket_object" "files_in_bucket" {
  for_each = fileset("../build/", "**")
  bucket = aws_s3_bucket.website-bucket.id
  key = each.value
  source = "../build/${each.value}"
  etag = filemd5("../build/${each.value}")
  content_type = lookup(local.mime_types, regex("\\.[^.]+$", each.value), null)
  tags = local.tags
}

resource "aws_iam_policy" "website-bucket-role-policy" {
  tags = local.tags
  name = "${local.tags.App}-website-bucket-policy"
  policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowS3BucketResourceActions",
        "Effect": "Allow",
        "Action": "s3:*",
        "Resource": aws_s3_bucket.website-bucket.arn
      },
      {
        "Sid": "AllowS3ObjectResourceActions",
        "Effect": "Allow",
        "Action": "s3:*",
        "Resource": "${aws_s3_bucket.website-bucket.arn}/*"
      }
    ]
  })
}

resource "aws_iam_policy_attachment" "website-bucket-role-policy_attachment" {
  policy_arn = aws_iam_policy.website-bucket-role-policy.arn
  name = local.deploy_role_name
  roles = [local.deploy_role_name]
}

resource "aws_iam_policy" "state-bucket-role-policy" {
  tags = local.tags
  name = "${local.tags.App}-state-bucket-policy"
  policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowDynamoDBStateLockActions",
        "Effect": "Allow",
        "Action": [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:DeleteItem"
        ],
        "Resource": "arn:aws:s3:::${local.state_bucket_name}"
      },
      {
        "Sid": "AllowS3BackendBucketActions",
        "Effect": "Allow",
        "Action": "s3:ListBucket",
        "Resource": "arn:aws:s3:::${local.state_bucket_name}"
      },
      {
        "Sid": "AllowS3BackendObjectActions",
        "Effect": "Allow",
        "Action": [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ],
        "Resource": "arn:aws:s3:::${local.state_bucket_name}/tf-remote-state"
      }
    ]
  })
}

resource "aws_iam_policy_attachment" "state-bucket-role-policy_attachment" {
  policy_arn = aws_iam_policy.state-bucket-role-policy.arn
  name = local.deploy_role_name
  roles = [local.deploy_role_name]
}

output "website_url" {
  value = aws_s3_bucket_website_configuration.website-configuration.website_endpoint
}
