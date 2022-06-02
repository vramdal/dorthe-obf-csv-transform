provider "aws" {
  region  = "eu-central-1"

  assume_role {
    # The role ARN within Account B to AssumeRole into. Created in step 1.
    role_arn    = "arn:aws:iam::310400525929:role/deploy-dorthe-obf-csv-transform"
  }
}

locals {
  website_bucket_name = "s3-website-dorthe-obf.aws.vidarramdal.com"
  mime_types = jsondecode(file("./mime.json"))
}

terraform {
  backend "s3" {
    bucket = "dorthe-obf-csv-transform"
    key    = "tf-remote-state"
    region = "eu-central-1"
  }
}

resource "aws_s3_bucket" "website-bucket" {
  bucket = local.website_bucket_name
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
  policy = templatefile("templates/s3-policy.json", { bucket = local.website_bucket_name })

}

resource "aws_s3_bucket_object" "object1" {
  for_each = fileset("../build/", "**")
  bucket = aws_s3_bucket.website-bucket.id
  key = each.value
  source = "../build/${each.value}"
  etag = filemd5("../build/${each.value}")
  content_type = lookup(local.mime_types, regex("\\.[^.]+$", each.value), null)
}
