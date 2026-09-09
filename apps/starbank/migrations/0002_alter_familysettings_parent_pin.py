from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('starbank', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='familysettings',
            name='parent_pin',
            field=models.CharField(default='1234', max_length=128),
        ),
    ]

