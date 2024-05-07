
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

export class EngineeringStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // EC2 instances
    const instanceType = new cdk.CfnParameter(this, 'InstanceType', {
      type: 'String',
      default: 't2.micro',
      allowedValues: ['t2.micro', 't2.small'],
      description: 'Enter the instance type (t2.micro or t2.small).'
    });

    const keyPair = new cdk.CfnParameter(this, 'KeyPair', {
      type: 'AWS::EC2::KeyPair::KeyName',
      description: 'Key pair to SSH into EC2 instances'
    });

    const yourIp = new cdk.CfnParameter(this, 'YourIp', {
      type: 'String',
      description: 'Your public IP address'
    });

    // VPC
    const vpc = new ec2.Vpc(this, 'EngineeringVpc', {
      cidr: '10.0.0.0/18',
      enableDnsSupport: true,
      enableDnsHostnames: true
    });

    // Subnets
    const subnet1 = new ec2.Subnet(this, 'PublicSubnet1', {
      vpcId: vpc.vpcId,
      cidrBlock: '10.0.0.0/24',
      mapPublicIpOnLaunch: true,
      availabilityZone: 'us-east-1a'
    });

    const subnet2 = new ec2.Subnet(this, 'PublicSubnet2', {
      vpcId: vpc.vpcId,
      cidrBlock: '10.0.1.0/24',
      mapPublicIpOnLaunch: true,
      availabilityZone: 'us-east-1b'
    });

    // Internet Gateway
    const internetGateway = new ec2.CfnInternetGateway(this, 'InternetGateway');

    const vpcGatewayAttachment = new ec2.CfnVPCGatewayAttachment(this, 'VPCGatewayAttachment', {
      vpcId: vpc.vpcId,
      internetGatewayId: internetGateway.ref
    });

    // Route Table
    const publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.vpcId
    });

    const publicRoute = new ec2.CfnRoute(this, 'PublicRoute', {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: internetGateway.ref
    });
    publicRoute.addDependsOn(vpcGatewayAttachment);

    // Associate route table with subnets
    publicRouteTable.addDependsOn(subnet1);
    publicRouteTable.addDependsOn(subnet2);
    new ec2.CfnSubnetRouteTableAssociation(this, 'Subnet1RouteTableAssociation', {
      subnetId: subnet1.subnetId,
      routeTableId: publicRouteTable.ref
    });
    new ec2.CfnSubnetRouteTableAssociation(this, 'Subnet2RouteTableAssociation', {
      subnetId: subnet2.subnetId,
      routeTableId: publicRouteTable.ref
    });

    // IAM Role and Instance Profile
    const webInstanceRole = new iam.Role(this, 'WebInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess')]
    });

    const webInstanceProfile = new iam.CfnInstanceProfile(this, 'WebInstanceProfile', {
      roles: [webInstanceRole.roleName]
    });

    // Security Group
    const webServersSG = new ec2.SecurityGroup(this, 'WebserversSG', {
      vpc,
      description: 'Enable SSH and HTTP access'
    });
    webServersSG.addIngressRule(ec2.Peer.ipv4(yourIp.valueAsString), ec2.Port.tcp(22));
    webServersSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    // EC2 Instances
    const userDataScript = ec2.UserData.forLinux();
    userDataScript.addCommands(
      'yum update -y',
      'yum install -y git httpd php',
      'service httpd start',
      'chkconfig httpd on',
      'aws s3 cp s3://seis665-public/index.php /var/www/html/'
    );

    const instanceProps: ec2.CfnInstanceProps = {
      instanceType: instanceType.valueAsString,
      keyName: keyPair.valueAsString,
      imageId: 'ami-01cc34ab2709337aa',
      subnetId: subnet1.subnetId,
      userData: cdk.Fn.base64(userDataScript.render()),
      securityGroupIds: [webServersSG.securityGroupId],
      iamInstanceProfile: webInstanceProfile.ref,
      tags: [{ key: 'Name', value: 'web1' }]
    };
    new ec2.CfnInstance(this, 'web1', instanceProps);

    const instanceProps2: ec2.CfnInstanceProps = {
      instanceType: instanceType.valueAsString,
      keyName: keyPair.valueAsString,
      imageId: 'ami-01cc34ab2709337aa',
      subnetId: subnet2.subnetId,
      userData: cdk.Fn.base64(userDataScript.render()),
      securityGroupIds: [webServersSG.securityGroupId],
      iamInstanceProfile: webInstanceProfile.ref,
      tags: [{ key: 'Name', value: 'web2' }]
    };
    new ec2.CfnInstance(this, 'web2', instanceProps2);

    // Load Balancer
    const engineeringLB = new elbv2.ApplicationLoadBalancer(this, 'EngineeringLB', {
      vpc,
      internetFacing: true,
      securityGroup: webServersSG,
      vpcSubnets: { subnets: [subnet1, subnet2] }
    });

    // Target Group
    const engineeringTargetGroup = new elbv2.ApplicationTargetGroup(this, 'EngineeringTargetGroup', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      vpc: vpc,
      healthCheck: {
        enabled: true,
        interval: cdk.Duration.seconds(30),
        path: '/',
        protocol: elbv2.Protocol.HTTP,
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2
      }
    });

    // Listener
    engineeringLB.addListener('EngineeringLBListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([engineeringTargetGroup])
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      description: 'DNS name of the Load Balancer',
      value: engineeringLB.loadBalancerDnsName
    });
  }
}
