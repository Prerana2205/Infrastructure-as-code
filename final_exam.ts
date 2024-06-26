{
    "AWSTemplateFormatVersion": "2010-09-09",
    "Parameters": {
        "s3BucketName": {
            "Description": "S3 bucket name where the code is stored",
            "Type": "String"
        },
        "s3ObjectKey": {
            "Description": "S3 object key of the code",
            "Type": "String"
        }
    },
    "Resources": {
        "ArtifactBucket": {
            "Type": "AWS::S3::Bucket",
            "Properties": {
                "BucketEncryption": {
                    "ServerSideEncryptionConfiguration": [
                        {
                            "ServerSideEncryptionByDefault": {
                                "SSEAlgorithm": "AES256"
                            }
                        }
                    ]
                }
            }
        },
        "ArtifactBucketPolicy": {
            "Type": "AWS::S3::BucketPolicy",
            "Properties": {
                "Bucket": {
                    "Ref": "ArtifactBucket"
                },
                "PolicyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "DenyUnEncryptedObjectUploads",
                            "Effect": "Deny",
                            "Principal": "*",
                            "Action": "s3:PutObject",
                            "Resource": {
                                "Fn::Join": [
                                    "",
                                    [
                                        {
                                            "Fn::GetAtt": [
                                                "ArtifactBucket",
                                                "Arn"
                                            ]
                                        },
                                        "/*"
                                    ]
                                ]
                            },
                            "Condition": {
                                "StringNotEquals": {
                                    "s3:x-amz-server-side-encryption": "aws:kms"
                                }
                            }
                        }
                    ]
                }
            }
        },
        "AppBuildProject": {
            "Type": "AWS::CodeBuild::Project",
            "Properties": {
                "Artifacts": {
                    "Location": {
                        "Ref": "ArtifactBucket"
                    },
                    "Type": "S3",
                    "OverrideArtifactName": "true",
                    "Name": "artifact.zip",
                    "Packaging": "ZIP"
                },
                "Description": "app build project",
                "Environment": {
                    "ComputeType": "BUILD_GENERAL1_SMALL",
                    "Image": "aws/codebuild/standard:5.0",
                    "ImagePullCredentialsType": "CODEBUILD",
                    "Type": "LINUX_CONTAINER"
                },
                "ServiceRole": {
                    "Fn::GetAtt": [
                        "AppBuildRole",
                        "Arn"
                    ]
                },
                "Source": {
                    "Type": "CODECOMMIT",
                    "Location": "java-project",
                    "GitCloneDepth": 1
                },
                "Triggers": {
                    "Webhook": true
                }
            }
        },
        "AppBuildRole": {
            "Type": "AWS::IAM::Role",
            "Properties": {
                "AssumeRolePolicyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {
                                "Service": [
                                    "codebuild.amazonaws.com"
                                ]
                            },
                            "Action": [
                                "sts:AssumeRole"
                            ]
                        }
                    ]
                },
                "Path": "/",
                "Policies": [
                    {
                        "PolicyName": "CodeBuildAccess",
                        "PolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Action": [
                                        "s3:GetObject",
                                        "s3:GetObjectVersion",
                                        "s3:GetBucketAcl",
                                        "s3:GetBucketLocation",
                                        "s3:PutObject"
                                    ],
                                    "Resource": [
                                        {
                                            "Fn::Sub": "arn:aws:s3:::${s3BucketName}/*"
                                        }
                                    ]
                                }
                            ]
                        }
                    },
                    {
                        "PolicyName": "CodePipelineAccess",
                        "PolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Action": [
                                        "codecommit:GetBranch",
                                        "codecommit:GetCommit",
                                        "codecommit:GetRepository",
                                        "codecommit:GetUploadArchiveStatus",
                                        "codecommit:CancelUploadArchive",
                                        "codecommit:ListBranches",
                                        "codecommit:ListRepositories",
                                        "codecommit:UploadArchive"
                                    ],
                                    "Resource": "*"
                                }
                            ]
                        }
                    },
                    {
                        "PolicyName": "CodeCommitPolicy",
                        "PolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Sid": "CodeCommitPolicy",
                                    "Effect": "Allow",
                                    "Action": [
                                        "codecommit:GitPull"
                                    ],
                                    "Resource": [
                                        "*"
                                    ]
                                }
                            ]
                        }
                    }
                ]
            }
        },
        "BuildLogPolicy": {
            "Type": "AWS::IAM::Policy",
            "Properties": {
                "PolicyName": "BuildLogAccess",
                "PolicyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": [
                                "logs:CreateLogGroup",
                                "logs:CreateLogStream",
                                "logs:PutLogEvents"
                            ],
                            "Resource": [
                                {
                                    "Fn::Sub": "arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/codebuild/*"
                                }
                            ]
                        }
                    ]
                },
                "Roles": [
                    {
                        "Ref": "AppBuildRole"
                    }
                ]
            }
        }
    }
}
