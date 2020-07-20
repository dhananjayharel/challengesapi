// load aws sdk
var aws = require('aws-sdk');
aws.config.update({region: 'us-east-1'});
var pathv = '/home/ubuntu/rdplabs_app/rdplabsapi/server/aws-config.json';

aws.config.loadFromPath(pathv);


// load AWS SES
var ses = new aws.SES({apiVersion: '2010-12-01'});
var emailHeader="  <body style=\"\">"+
"    <table align=\"center\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" class=\"table-responsive\" width=\"600\">"+
"      <tbody>"+
"        "+
"        <tr>"+
"          <td>"+
"            <table align=\"center\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">"+
"              <tbody>"+
"                <tr>"+
"                  <td class=\"text-left p-l-10\" style=\"background: #2e80b7; padding: 16px 50px 11px;\"><a href=\"http://www.skillstack.com/\" target=\"_blank\"><img alt=\"\" class=\"img-responsive\" src=\"http://www.skillstack.com/assets/images/logo-transparent.png\" style=\"max-width: 20px;vertical-align: bottom;\" /> <span style=\"font-size: 16px;line-height:18px;color:#FFF;font-weight: bold;\">Skill Stack</span> </a>"+
"                  </td>"+
"                </tr>"+
"              </tbody>"+
"            </table>"+
"          </td>"+
"        </tr>"+
"        <!-- header --><!-- menu --><!-- banner --><!-- banner-btm -->"+
"        <tr>"+
"          <td>"+
"            <table align=\"center\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">"+
"              <tbody>"+
"                <tr>"+
"                  <td class=\"text-left p-10\" style=\"text-align: left; padding: 25px 50px;\">";

var emailFooter="<br><br><br><p style=\"font-size:13px;color: #435464; font-family: Arial, sans-serif, 'Open Sans'; margin: 0; padding: 0;\">Best Regards,<br>"+
"                    SkillStack"+
"                  </p></td>"+
"                </tr>"+
"              </tbody>"+
"            </table>"+
"          </td>"+
"        </tr>"+
"        <!-- intro --><!-- heading --><!-- bar --><!-- space -->"+
"        <tr>"+
"          <td>"+
"            <table align=\"center\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">"+
"            </table>"+
"          </td>"+
"        </tr>"+
"        <!-- intro --><!-- intro -->"+
"        "+
"        <!-- footer -->"+
"        <tr>"+
"          <td>"+
"            <table align=\"center\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"600\">"+
"              <tbody>"+
"                <tr>"+
"                  <td class=\"text-left p-l-10\" style=\"background: #f0f0f0; padding: 16px 50px 11px;\">"+
"                      <a style=\"margin-right: 10px;\" href=\"http://www.skillstack.com/\" target=\"_blank\"><span style=\"font-size: 12px;line-height:18px;color:#000;font-weight: bold;\">Home</span> </a>"+
"                      |"+
"                      <a style=\"margin:0 10px;\"href=\"http://www.skillstack.com/\" target=\"_blank\"><span style=\"font-size: 12px;line-height:18px;color:#000;font-weight: bold;\">Terms & Conditions</span> </a>"+
"                      |"+
"                      <a style=\"margin:0 10px;\"href=\"http://www.skillstack.com/\" target=\"_blank\"><span style=\"font-size: 12px;line-height:18px;color:#000;font-weight: bold;\">Privacy Policy</span> </a>"+
"                  </td>"+
"                </tr>"+
"              </tbody>"+
"            </table>"+
"          </td>"+
"        </tr>"+
"      </tbody>"+
"    </table>"+
"    <!-- container --></body>";





	function sendMail(Message){
               console.log(Message);
			   
		// this sends the email
		// @todo - add HTML version

		// send to list
		var from = 'info@programmr.com';

		// this must relate to a verified SES account
		var to  = [];
              to.push(Message.to);
		ses.sendEmail( 
			{ 
				Source: from, 
				Destination: { ToAddresses: to },
				Message: {
					Subject: {
						Data: Message.subject
					},
					Body: {
						Html: {
							Data: emailHeader + Message.body + emailFooter,
						}
					}
				}
			}
		, function(err, data) {
			if(err) throw err
			console.log('Email sent:');
			console.log(data);
		});
	}


exports.sendMail=sendMail;