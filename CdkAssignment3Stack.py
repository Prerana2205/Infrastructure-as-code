from aws_cdk import (
    Stack,
    CfnOutput,
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_elasticloadbalancingv2 as elbv2,
    aws_autoscaling as autoscaling,
)

from constructs import Construct

class CdkAssignment3Stack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # Create VPC
          # create new VPC in the Local Zone
        vpc = self.create_vpc()
         # create db mysql
        self.create_db_mysql(vpc)
        
        

        
    def create_vpc(self):
         vpc = ec2.Vpc(
            self,
            "MyVpc",
            max_azs=2,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name = 'Public-Subnet',
                    subnet_type = ec2.SubnetType.PUBLIC
                ),
                ec2.SubnetConfiguration(
                    name = 'Private-Subent1',
                    subnet_type = ec2.SubnetType.PRIVATE_ISOLATED
                ),
                # ec2.SubnetConfiguration(
                #     name = 'Public-Subent2',
                #     subnet_type = ec2.SubnetType.PUBLIC
                # ),
                # ec2.SubnetConfiguration(
                #     name = 'Private-Subent2',
                #     subnet_type = ec2.SubnetType.PRIVATE_ISOLATED
                # )
            ]
        )
         return vpc
    
    def create_db_mysql(self, vpc):
         # Web Server Security Group
        web_server_security_group = ec2.SecurityGroup(
            self, "WebServerSecurityGroup", vpc=vpc)
        web_server_security_group.add_ingress_rule(
            ec2.Peer.any_ipv4(), ec2.Port.tcp(80), "Allow HTTP traffic from anywhere")
        rds_security_group = ec2.SecurityGroup(
            self, "RDSSecurityGroup", vpc=vpc)
        rds_security_group.add_ingress_rule(
            web_server_security_group, ec2.Port.tcp(3306), "Allow MySQL traffic from Web Servers")
            
        rds.DatabaseInstance(self, "MySqlInstance",
            engine=rds.DatabaseInstanceEngine.mysql(version=rds.MysqlEngineVersion.VER_8_0),
            instance_type=ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            vpc=vpc,
            deletion_protection=False,
            security_groups=[rds_security_group]
        )
        #         # Launch Web Servers
        selected_subnets = vpc.select_subnets(subnet_type=ec2.SubnetType.PUBLIC)
        for subnet in selected_subnets.subnets:
          
             print(f"Availability zone-{subnet.availability_zone}")
             ec2.Instance(self, f"WebServer-{subnet.availability_zone}",
                         instance_type=ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
                         machine_image=ec2.MachineImage.latest_amazon_linux(),
                         vpc=vpc,
                         vpc_subnets=ec2.SubnetSelection(subnets=[subnet]),
                         security_group=web_server_security_group
                         )
        
        #         rds.DatabaseInstance(self, 'MyDatabase',
#                              engine=rds.DatabaseInstanceEngine.mysql(version=rds.MysqlEngineVersion.VER_8_0),
#                              instance_type=ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
#                              vpc=vpc,
#                              vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE),
#                              security_groups=[rds_security_group]
 #                            )
        



# class ServerStack(Stack):
#     def __init__(self, scope: Construct, id: str, network_stack: NetworkServerStack, **kwargs) -> None:
#         super().__init__(scope, id, **kwargs)

#         vpc = network_stack.vpc

#         # Web Server Security Group
#         web_server_security_group = ec2.SecurityGroup(
#             self, "WebServerSecurityGroup", vpc=vpc)
#         web_server_security_group.add_ingress_rule(
#             ec2.Peer.any_ipv4(), ec2.Port.tcp(80), "Allow HTTP traffic from anywhere")

#         # RDS Security Group
#         rds_security_group = ec2.SecurityGroup(
#             self, "RDSSecurityGroup", vpc=vpc)
#         rds_security_group.add_ingress_rule(
#             web_server_security_group, ec2.Port.tcp(3306), "Allow MySQL traffic from Web Servers")

#         # Launch Web Servers
#         for subnet_id in network_stack.public_subnets:
#             ec2.Instance(self, f"WebServer-{subnet_id}",
#                          instance_type=ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
#                          machine_image=ec2.MachineImage.latest_amazon_linux(),
#                          vpc=vpc,
#                          vpc_subnets=ec2.SubnetSelection(subnets=[ec2.Subnet.from_subnet_id(self, f"Subnet-{subnet_id}", subnet_id)]),
#                          security_group=web_server_security_group
#                          )

#         # Create RDS Instance
#         rds.DatabaseInstance(self, 'MyDatabase',
#                              engine=rds.DatabaseInstanceEngine.mysql(version=rds.MysqlEngineVersion.VER_8_0),
#                              instance_type=ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
#                              vpc=vpc,
#                              vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE),
#                              security_groups=[rds_security_group]
 #                            )

#app = core.App()
#network_stack = NetworkServerStack(app, "NetworkStack")
#ServerStack(app, "ServerStack", network_stack=network_stack)
